defmodule GroupherServerWeb.Schema.Helper.Fields do
  @moduledoc """
  Reusable Absinthe field macros for pagination, dashboard settings, and relations.

  Business position:

      Client
        -> Absinthe schema / Fields
        -> resolver or domain context
        -> GraphQL response
  """
  import Helper.Utils, only: [plural: 1]
  import Absinthe.Resolution.Helpers, only: [dataloader: 2]

  alias GroupherServer.CMS

  @emotions CMS.artiment_config_emotions()
  @comment_emotions CMS.artiment_config_comment_emotions()
  @all_emotions (@emotions ++ @comment_emotions) |> Enum.uniq()
  @threads CMS.artiment_config_threads()

  @doc "general article fields for GraphQL resolve fields"
  defmacro general_article_fields do
    quote do
      field(:inner_id, :id)
      field(:version, non_null(:integer))
      field(:title, :string)

      field(:body, non_null(:artiment_body),
        resolve: fn source, _args, _resolution ->
          GroupherServerWeb.Schema.Helper.Fields.article_body(source)
        end
      )

      field(:thumbnail, :json,
        resolve: fn source, _args, _resolution ->
          case GroupherServerWeb.Schema.Helper.Fields.article_body(source) do
            {:ok, nil} -> {:ok, nil}
            {:ok, document} -> {:ok, Map.get(document, :thumbnail)}
            error -> error
          end
        end
      )

      field(:asset_refs, non_null(list_of(non_null(:article_asset_ref))),
        resolve: fn source, _args, _resolution ->
          case Map.fetch(source, :asset_refs) do
            {:ok, asset_refs} -> {:ok, asset_refs}
            :error -> {:error, CMS.error_cat_invalid_body("Article asset refs are missing")}
          end
        end
      )

      field(:digest, :string)
      field(:article_stats, :article_stats)
      field(:is_pinned, :boolean)
      field(:cover_url, :string)
      field(:cover_url_dark, :string)

      field(:cover_edit_info, :cover_edit_info,
        resolve: &GroupherServerWeb.Resolvers.CMS.Articles.cover_edit_info/3
      )

      field(:community_tags, list_of(:community_tag),
        resolve: fn source, args, resolution ->
          GroupherServerWeb.Schema.Helper.Fields.article_relation(
            source,
            args,
            resolution,
            :community_tags
          )
        end
      )

      field(:author, :user,
        resolve: fn source, args, resolution ->
          GroupherServerWeb.Schema.Helper.Fields.article_relation(
            source,
            args,
            resolution,
            :author
          )
        end
      )

      field(:community, :community,
        resolve: fn source, args, resolution ->
          GroupherServerWeb.Schema.Helper.Fields.article_relation(
            source,
            args,
            resolution,
            :community
          )
        end
      )

      field(:communities, list_of(:community),
        resolve: fn source, args, resolution ->
          GroupherServerWeb.Schema.Helper.Fields.article_relation(
            source,
            args,
            resolution,
            :communities
          )
        end
      )

      field(:meta, :article_meta)

      field(:command_id, :id,
        resolve: &GroupherServerWeb.Resolvers.CMS.CommandPayload.command_id/3
      )

      field(:lifecycle, :article_lifecycle,
        resolve: fn source, args, resolution ->
          GroupherServerWeb.Schema.Helper.Fields.article_relation(
            source,
            args,
            resolution,
            :lifecycle
          )
        end
      )

      field(:copy_right, :string)
      field(:link_addr, :string)
    end
  end

  @doc "Returns an already assembled Article DTO relation or delegates legacy structs to Dataloader."
  @spec article_relation(map(), map(), Absinthe.Resolution.t(), atom()) :: term()
  def article_relation(source, args, resolution, relation) do
    case Map.fetch(source, relation) do
      {:ok, %Ecto.Association.NotLoaded{}} -> load_relation(source, args, resolution, relation)
      {:ok, value} -> {:ok, value}
      :error -> load_relation(source, args, resolution, relation)
    end
  end

  @doc "Returns the canonical Article body from the assembled projection without a legacy fallback."
  @spec article_body(map()) :: {:ok, term()} | {:error, term()}
  def article_body(source) do
    case Map.fetch(source, :body) do
      {:ok, body} -> {:ok, body}
      :error -> {:error, CMS.error_cat_invalid_body("Article body projection is missing")}
    end
  end

  defp load_relation(source, args, resolution, relation) do
    resolver = Absinthe.Resolution.Helpers.dataloader(CMS, relation)
    resolver.(source, args, resolution)
  end

  @doc """
  generate thread enum based on @threads

  e.g:

  enum :post_thread, do: value(:post)
  enum :xxx_thread, do: value(:xxx)
  # ..
  """
  defmacro thread_enums do
    @threads
    |> Enum.map(
      &quote do
        enum(unquote(:"#{&1}_thread"), do: value(unquote(&1)))
      end
    )
  end

  @doc """
  generate thread value based on @threads

  e.g:

  value(:post)
  # ...
  """
  defmacro article_values do
    @threads
    |> Enum.map(
      &quote do
        value(unquote(&1))
      end
    )
  end

  @doc """
  general emotion enum for articles
  # NOTE: internal reaction projections are not exposed through GraphQL.
  """
  defmacro emotion_values(metric \\ :article) do
    emotions =
      case metric do
        :comment -> @comment_emotions
        # used by the sparse EmotionStat API output enum, which is shared by
        # both article and comment payloads.
        :all -> @all_emotions
        # UPVOTE/COLLECT have dedicated mutations and fixed ArticleStats fields;
        # they are not valid inputs for the generic emotion mutation.
        _ -> @emotions -- [:upvote, :collect]
      end

    emotions
    |> Enum.map(
      &quote do
        value(unquote(:"#{&1}"))
      end
    )
  end

  @doc """
  general emotions for articles

  e.g:
  ------
  beer_count
  viewer_has_beered
  latest_bear_users
  """
  defmacro emotion_fields do
    @emotions
    |> Enum.map(
      &quote do
        field(unquote(:"#{&1}_count"), :integer)
        field(unquote(:"viewer_has_#{&1}ed"), :boolean)
        field(unquote(:"latest_#{&1}_users"), list_of(:common_user))
      end
    )
  end

  defmacro emotion_fields(:comment) do
    @comment_emotions
    |> Enum.map(
      &quote do
        field(unquote(:"#{&1}_count"), :integer)
        field(unquote(:"viewer_has_#{&1}ed"), :boolean)
        field(unquote(:"latest_#{&1}_users"), list_of(:common_user))
      end
    )
  end

  @doc """
  general timestamp with active_at for article
  """
  defmacro timestamp_fields(:article) do
    quote do
      field(:inserted_at, :datetime)
      field(:updated_at, :datetime)
      field(:active_at, :datetime)
    end
  end

  defmacro timestamp_fields do
    quote do
      field(:inserted_at, :datetime)
      field(:updated_at, :datetime)
    end
  end

  defmacro comment_general_fields do
    quote do
      field(:inner_id, :id, resolve: &GroupherServerWeb.Resolvers.CMS.Comments.comment_inner_id/3)

      field(:body, non_null(:artiment_body),
        resolve: &GroupherServerWeb.Schema.Helper.Fields.comment_body/3
      )

      field(:body_version, non_null(:integer),
        resolve: &GroupherServerWeb.Schema.Helper.Fields.comment_body_version/3
      )

      field(:author, :user, resolve: dataloader(CMS, :author))
      field(:is_pinned, :boolean)
      field(:root_inner_id, :id)
      field(:floor, :integer)
      field(:upvotes_count, :integer)
      field(:comment_interaction_revision, :integer)

      field(:command_id, :id,
        resolve: &GroupherServerWeb.Resolvers.CMS.CommandPayload.command_id/3
      )

      field(:reaction_outcome, :reaction_outcome)
      field(:is_article_author, :boolean)

      field(:emotions, list_of(:emotion_stat),
        resolve: &GroupherServerWeb.Resolvers.CMS.Interactions.emotions/3
      )

      field(:meta, :comment_meta)
      field(:replies_count, :integer)
      field(:thread, :thread)
      field(:viewer_has_upvoted, :boolean)

      field(:reply_to_comment, :comment,
        resolve: fn parent, args, resolution ->
          case Map.get(parent, :reply_to_comment) do
            %Ecto.Association.NotLoaded{} ->
              dataloader(CMS, :reply_to_comment).(parent, args, resolution)

            loaded ->
              {:ok, loaded}
          end
        end
      )

      field(:lifecycle, :comment_lifecycle, resolve: dataloader(CMS, :lifecycle))

      timestamp_fields()
    end
  end

  @doc "Resolves a Comment body from a preloaded projection or canonical body row."
  def comment_body(%{body: %GroupherServer.CMS.Model.CommentBody{} = body}, _, _), do: {:ok, body}

  def comment_body(%{id: comment_id}, _, _) do
    case GroupherServer.Repo.get_by(GroupherServer.CMS.Model.CommentBody, comment_id: comment_id) do
      nil -> {:error, "comment body not found"}
      body -> {:ok, body}
    end
  end

  @doc "Resolves a Comment body version from a preloaded projection or canonical body row."
  def comment_body_version(
        %{body: %GroupherServer.CMS.Model.CommentBody{version: version}},
        _,
        _
      ) do
    {:ok, version}
  end

  def comment_body_version(%{id: comment_id}, _, _) do
    case GroupherServer.Repo.get_by(GroupherServer.CMS.Model.CommentBody, comment_id: comment_id) do
      nil -> {:error, "comment body not found"}
      body -> {:ok, body.version}
    end
  end

  # see: https://github.com/absinthe-graphql/absinthe/issues/363
  @doc "Exposes canonical PageInfo from the shared Pagi result."
  defmacro pagi_fields do
    quote do
      field :page_info, non_null(:page_info) do
        resolve(fn page, _, _ -> {:ok, Helper.ORM.Pagi.Page.info(page)} end)
      end
    end
  end

  defmacro article_filter_fields do
    quote do
      field(:when, :when_enum)
      field(:community_tag, :string)
      field(:cat, :article_cat_enum)
      field(:status, :article_status_enum)
      field(:statuses, list_of(non_null(:article_status_enum)))
      field(:order, :article_order_enum)
      field(:community_tags, list_of(:string))
      field(:community, :string)
    end
  end

  @doc """
  General social profile fields for a user.

  These fields map to one `accounts.socials` row per user, not a list of social
  links. Add a new field here only when the fixed profile shape grows.
  """
  defmacro social_fields do
    quote do
      field(:github, :string)
      field(:company, :string)
      field(:blog, :string)
      field(:douban, :string)
      field(:twitter, :string)
      field(:zhihu, :string)
      field(:dribble, :string)
      field(:pinterest, :string)
      field(:huaban, :string)
    end
  end

  defmacro threads_count_fields do
    @threads
    |> Enum.map(
      &quote do
        field(unquote(:"#{plural(&1)}_count"), :integer)
      end
    )
  end

  defmacro comments_fields do
    quote do
      field(:comments_participants, list_of(:user))
    end
  end

  @doc """
  general collect folder meta info
  """
  defmacro collect_folder_meta_fields do
    @threads
    |> Enum.map(fn thread ->
      quote do
        field(unquote(:"has_#{thread}"), :boolean)
        field(unquote(:"#{thread}_count"), :integer)
      end
    end)
  end

  @doc """
  fields for dsb seo
  """
  defmacro dsb_cast_fields(section \\ :layout) do
    schema = GroupherServer.CMS.dashboard_fields_macro_schema(section) |> Macro.escape()

    quote do
      Enum.reduce(unquote(schema), [], fn [k, _, _], acc ->
        [k] ++ acc
      end)
    end
  end

  defmacro dsb_args(section \\ :layout, opts \\ []) do
    except = Keyword.get(opts, :except, [])

    fields =
      GroupherServer.CMS.dashboard_fields_macro_schema(section)
      |> Enum.reject(fn [key, _type, _default_v] -> key in except end)
      |> Enum.map(fn item ->
        [key, type, _default_v] = item

        quote do
          arg(unquote(key), unquote(to_absinthe_type(type, key)))
        end
      end)

    [
      quote do
        arg(:command_id, non_null(:id))
      end
      | fields
    ]
  end

  defmacro dsb_fields(section \\ :layout) do
    GroupherServer.CMS.dashboard_fields_macro_schema(section)
    |> Enum.map(fn item ->
      [key, type, default_v] = item
      default_ast = Macro.escape(default_v)

      case type do
        :enum ->
          quote do
            # Dsb enums use the default Ecto.Enum flow:
            #   [:quora, :ph] -> internal :quora / :ph -> DB "quora" / "ph"
            field(unquote(key), Ecto.Enum,
              values: unquote(GroupherServer.CMS.dashboard_fields_enum_values(key)),
              default: unquote(default_ast)
            )
          end

        :rainbow_color ->
          quote do
            field(unquote(key), Ecto.Enum,
              values: unquote(GroupherServer.CMS.dashboard_fields_rainbow_colors()),
              default: unquote(default_ast)
            )
          end

        {:array, :kanban_board} ->
          quote do
            field(unquote(key), {:array, Ecto.Enum},
              values: unquote(GroupherServer.CMS.dashboard_kanban_boards_values_list()),
              default: unquote(default_ast)
            )
          end

        {:array, :rainbow_color} ->
          quote do
            field(unquote(key), {:array, Ecto.Enum},
              values: unquote(GroupherServer.CMS.dashboard_fields_rainbow_colors()),
              default: unquote(default_ast)
            )
          end

        _ ->
          quote do
            field(unquote(key), unquote(to_ecto_type(type)), default: unquote(default_ast))
          end
      end
    end)
  end

  defp build_dsb_gq_fields(section, opts) do
    except = Keyword.get(opts, :except, [])

    GroupherServer.CMS.dashboard_fields_macro_schema(section)
    |> Enum.reject(fn [key, _type, _default_v] -> key in except end)
    |> Enum.map(fn item ->
      [key, type, _default_v] = item

      quote do
        field(unquote(key), unquote(to_absinthe_type(type, key)))
      end
    end)
  end

  defmacro dsb_gq_fields(section \\ :layout, opts \\ []) do
    build_dsb_gq_fields(section, opts)
  end

  @doc """
  Expand a dashboard section schema into GraphQL input-object fields.

  This keeps section patch inputs aligned with `Dashboard.macro_schema/1`,
  while `dsb_args/2` remains for legacy flat mutation arguments. This macro is
  intentionally a semantic wrapper around the same generator as `dsb_gq_fields/2`:
  Absinthe accepts the same `field/2` declarations inside object and input-object
  blocks, so the actual field-generation logic should stay in one place.

  ## Example

      input_object :dsb_bg_config_input do
        dsb_input_fields(:wallpaper_bg)
      end

  """
  defmacro dsb_input_fields(section \\ :layout, opts \\ []) do
    build_dsb_gq_fields(section, opts)
  end

  defmacro dsb_default(section \\ :layout) do
    schema = GroupherServer.CMS.dashboard_fields_macro_schema(section) |> Macro.escape()

    quote do
      Enum.reduce(unquote(schema), %{}, fn [k, _t, v], acc ->
        Map.put(acc, k, v)
      end)
    end
  end

  # Convert dsb metric DSL types to Ecto field types.
  # Supports list-like types in shared dsb schema definitions.
  defp to_ecto_type({:array, inner}), do: {:array, to_ecto_type(inner)}
  defp to_ecto_type(type), do: type

  # Convert dsb metric DSL types to Absinthe field/arg type AST.
  # Supports list-like types in shared dsb schema definitions.
  defp to_absinthe_type({:array, inner}, _key) do
    quote(do: list_of(unquote(to_absinthe_type(inner, nil))))
  end

  defp to_absinthe_type(:enum, :doc_cover_layout), do: :dsb_doc_cover_layout

  defp to_absinthe_type(:enum, key) when key in [:theme_preset, :theme_preset_base] do
    :dsb_theme_preset
  end

  defp to_absinthe_type(:enum, key), do: :"dsb_#{key}"
  defp to_absinthe_type(:rainbow_color, _key), do: :rainbow_color
  defp to_absinthe_type(:map, _key), do: :json
  defp to_absinthe_type(type, _key), do: type

  # Expand dashboard enum registry into GraphQL enums.
  #
  # Example:
  #   dsb_enum(:post_layout)
  #
  # Expands into:
  #   enum :dsb_post_layout do
  #     value(:quora)
  #     value(:ph)
  #   end
  #
  # Absinthe will expose QUORA / PH over GraphQL and map them back to
  # internal :quora / :ph atoms automatically.
  defmacro dsb_enum(enum_key) do
    values = GroupherServer.CMS.dashboard_fields_enum_values(enum_key)

    type =
      case enum_key do
        :doc_cover_layout -> :dsb_doc_cover_layout
        _ -> :"dsb_#{enum_key}"
      end

    value_defs =
      Enum.map(values, fn value ->
        quote do
          value(unquote(value))
        end
      end)

    quote do
      enum unquote(type) do
        (unquote_splicing(value_defs))
      end
    end
  end

  defmacro enum_values(values_ast) do
    expanded = Macro.expand(values_ast, __CALLER__)

    if is_list(expanded) do
      for v <- expanded do
        quote do
          value(unquote(v))
        end
      end
    else
      raise ArgumentError,
            "enum_values/1 expects a compile-time list, got: #{Macro.to_string(expanded)}"
    end
  end
end
