defmodule GroupherServerWeb.Schema.Helper.Fields do
  @moduledoc """
  general fields used in GraphQL schema definition
  """
  import Helper.Utils, only: [get_config: 2, plural: 1]
  import Absinthe.Resolution.Helpers, only: [dataloader: 2]

  alias GroupherServer.CMS

  alias CMS.Helper.KanbanBoards
  alias CMS.Model.Metrics.Dashboard

  @page_size get_config(:general, :page_size)

  @emotions get_config(:article, :emotions)
  @comment_emotions get_config(:article, :comment_emotions)
  @all_emotions (@emotions ++ @comment_emotions) |> Enum.uniq()
  @article_threads get_config(:article, :threads)

  @doc "general article fields for GraphQL resolve fields"
  defmacro general_article_fields do
    quote do
      field(:inner_id, :id)
      field(:title, :string)
      field(:document, :thread_document, resolve: dataloader(CMS, :document))
      field(:digest, :string)
      field(:views, :integer)
      field(:is_pinned, :boolean)
      field(:mark_delete, :boolean)

      field(:community_tags, list_of(:community_tag), resolve: dataloader(CMS, :community_tags))
      field(:author, :user, resolve: dataloader(CMS, :author))
      field(:community, :community, resolve: dataloader(CMS, :community))
      field(:community_slug, :string)
      field(:communities, list_of(:community), resolve: dataloader(CMS, :communities))

      field(:meta, :article_meta)
      field(:upvotes_count, :integer)
      field(:collects_count, :integer)

      field(:emotions, list_of(:emotion_stat),
        resolve: &GroupherServerWeb.Resolvers.CMS.emotions/3
      )

      field(:viewer_has_collected, :boolean)
      field(:viewer_has_upvoted, :boolean)
      field(:viewer_has_viewed, :boolean)
      field(:viewer_has_reported, :boolean)

      field(:is_archived, :boolean)
      field(:archived_at, :datetime)

      field(:copy_right, :string)
      field(:link_addr, :string)

      field(:pending, :integer)
    end
  end

  @doc """
  generate thread enum based on @article_threads

  e.g:

  enum :post_thread, do: value(:post)
  enum :xxx_thread, do: value(:xxx)
  # ..
  """
  defmacro article_thread_enums do
    @article_threads
    |> Enum.map(
      &quote do
        enum(unquote(:"#{&1}_thread"), do: value(unquote(&1)))
      end
    )
  end

  @doc """
  generate thread value based on @article_threads

  e.g:

  value(:post)
  # ...
  """
  defmacro article_values do
    @article_threads
    |> Enum.map(
      &quote do
        value(unquote(&1))
      end
    )
  end

  @doc """
  general emotion enum for articles
  #NOTE: xxx_user_logins field is not support for gq-endpoint
  """
  defmacro emotion_values(metric \\ :article) do
    emotions =
      case metric do
        :comment -> @comment_emotions
        # used by the sparse EmotionStat API output enum, which is shared by
        # both article and comment payloads.
        :all -> @all_emotions
        _ -> @emotions
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
      field(:id, :id)
      field(:body, :string)
      field(:body_html, :string)
      field(:author, :user, resolve: dataloader(CMS, :author))
      field(:is_pinned, :boolean)
      field(:floor, :integer)
      field(:upvotes_count, :integer)
      field(:is_article_author, :boolean)

      field(:emotions, list_of(:emotion_stat),
        resolve: &GroupherServerWeb.Resolvers.CMS.emotions/3
      )

      field(:meta, :comment_meta)
      field(:replies_count, :integer)
      field(:thread, :thread)
      field(:viewer_has_upvoted, :boolean)
      field(:reply_to, :comment, resolve: dataloader(CMS, :reply_to))
      field(:reply_to_id, :id)

      field(:is_deleted, :boolean)
      field(:is_archived, :boolean)
      field(:archived_at, :datetime)

      timestamp_fields()
    end
  end

  # see: https://github.com/absinthe-graphql/absinthe/issues/363
  defmacro pagination_args do
    quote do
      field(:page, :integer, default_value: 1)
      field(:size, :integer, default_value: unquote(@page_size))
    end
  end

  @doc """
  general pagination fields except entries
  """
  defmacro pagination_fields do
    quote do
      field(:total_count, :integer)
      field(:page_size, :integer)
      field(:total_pages, :integer)
      field(:page_number, :integer)
    end
  end

  defmacro article_filter_fields do
    quote do
      field(:when, :when_enum)
      field(:community_tag, :string)
      field(:cat, :article_cat_enum)
      field(:state, :article_state_enum)
      field(:order, :article_order_enum)
      field(:community_tags, list_of(:string))
      field(:community, :string)
      field(:author, :string)
    end
  end

  @doc """
  general social used for user profile
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
    @article_threads
    |> Enum.map(
      &quote do
        field(unquote(:"#{plural(&1)}_count"), :integer)
      end
    )
  end

  defmacro comments_fields do
    quote do
      field(:comments_participants, list_of(:user))
      field(:comments_participants_count, :integer)
      field(:comments_count, :integer)
    end
  end

  @doc """
  general collect folder meta info
  """
  defmacro collect_folder_meta_fields do
    @article_threads
    |> Enum.map(fn thread ->
      quote do
        field(unquote(:"has_#{thread}"), :boolean)
        field(unquote(:"#{thread}_count"), :integer)
      end
    end)
  end

  @doc """
  fields for dashboard seo
  """
  defmacro dashboard_cast_fields(section \\ :layout) do
    schema = Dashboard.macro_schema(section) |> Macro.escape()

    quote do
      Enum.reduce(unquote(schema), [], fn [k, _, _], acc ->
        [k] ++ acc
      end)
    end
  end

  defmacro dashboard_args(section \\ :layout) do
    Dashboard.macro_schema(section)
    |> Enum.map(fn item ->
      [key, type, _default_v] = item

      quote do
        arg(unquote(key), unquote(to_absinthe_type(type, key)))
      end
    end)
  end

  defmacro dashboard_fields(section \\ :layout) do
    Dashboard.macro_schema(section)
    |> Enum.map(fn item ->
      [key, type, default_v] = item

      case type do
        :enum ->
          quote do
            # Dashboard enums use the default Ecto.Enum flow:
            #   [:quora, :ph] -> internal :quora / :ph -> DB "quora" / "ph"
            field(unquote(key), Ecto.Enum,
              values: unquote(Dashboard.enum_values(key)),
              default: unquote(default_v)
            )
          end

        :rainbow_color ->
          quote do
            field(unquote(key), Ecto.Enum,
              values: unquote(Dashboard.rainbow_colors()),
              default: unquote(default_v)
            )
          end

        {:array, :kanban_board} ->
          quote do
            field(unquote(key), {:array, Ecto.Enum},
              values: unquote(KanbanBoards.values_list()),
              default: unquote(default_v)
            )
          end

        {:array, :rainbow_color} ->
          quote do
            field(unquote(key), {:array, Ecto.Enum},
              values: unquote(Dashboard.rainbow_colors()),
              default: unquote(default_v)
            )
          end

        _ ->
          quote do
            field(unquote(key), unquote(to_ecto_type(type)), default: unquote(default_v))
          end
      end
    end)
  end

  defmacro dashboard_gq_fields(section \\ :layout) do
    Dashboard.macro_schema(section)
    |> Enum.map(fn item ->
      [key, type, _default_v] = item

      quote do
        field(unquote(key), unquote(to_absinthe_type(type, key)))
      end
    end)
  end

  defmacro dashboard_default(section \\ :layout) do
    schema = Dashboard.macro_schema(section) |> Macro.escape()

    quote do
      Enum.reduce(unquote(schema), %{}, fn [k, _t, v], acc ->
        Map.put(acc, k, v)
      end)
    end
  end

  # Convert dashboard metric DSL types to Ecto field types.
  # Supports list-like types in shared dashboard schema definitions.
  defp to_ecto_type({:array, inner}), do: {:array, to_ecto_type(inner)}
  defp to_ecto_type(type), do: type

  # Convert dashboard metric DSL types to Absinthe field/arg type AST.
  # Supports list-like types in shared dashboard schema definitions.
  defp to_absinthe_type({:array, inner}, _key),
    do: quote(do: list_of(unquote(to_absinthe_type(inner, nil))))

  defp to_absinthe_type(:enum, key), do: :"dsb_#{key}"
  defp to_absinthe_type(:rainbow_color, _key), do: :rainbow_color
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
    values = Dashboard.enum_values(enum_key)
    type = :"dsb_#{enum_key}"

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
