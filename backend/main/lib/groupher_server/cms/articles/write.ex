defmodule GroupherServer.CMS.Articles.Write do
  @moduledoc """
  Article write helpers.
  """

  import GroupherServer.CMS.Helper.Matcher
  import Helper.ErrorCode

  import Helper.Utils,
    only: [
      done: 1,
      plural: 1,
      module_to_atom: 1,
      module_to_upcase: 1,
      atom_values_to_upcase: 1
    ]

  alias GroupherServer.{Accounts, CMS, Email, Repo, Statistics}

  alias Accounts.Model.User
  alias CMS.Articles.{Document, Meta, Placement}
  alias CMS.Helper.ArticleEnums
  alias CMS.Model.{Author, Community, Embeds}
  alias CMS.{Communities, Events, FrontDesk}

  alias Ecto.Multi
  alias Helper.{Converter, Later, ORM, Transaction}
  alias Helper.Types, as: T

  @default_emotions Embeds.ArticleEmotion.default_emotions()
  @default_article_meta Embeds.ArticleMeta.default_meta()

  @spec create(Community.t(), atom(), map(), User.t()) :: T.domain_res(term())
  def create(%Community{} = community, thread, attrs, %User{} = user) do
    attrs = attrs |> atom_values_to_upcase() |> normalize_article_enum_attrs()

    with {:ok, author} <- ensure_author_exists(user),
         {:ok, info} <- match(thread) do
      Transaction.locking(community, fn community ->
        Multi.new()
        |> Multi.run(:create_article, fn _, _ ->
          do_create_article(info.model, attrs, author, community)
        end)
        |> Multi.run(:create_document, fn _, %{create_article: article} ->
          Document.create(article, attrs)
        end)
        |> Multi.run(:mirror_article, fn _, %{create_article: article} ->
          Placement.mirror(community, article)
        end)
        |> Multi.run(:set_community_tags, fn _, %{create_article: article} ->
          Communities.set_tags(community, thread, article, %{
            community_tags: Map.get(attrs, :community_tags, [])
          })
        end)
        |> Multi.run(:set_active_at_timestamp, fn _, %{create_article: article} ->
          ORM.update(article, %{active_at: article.inserted_at})
        end)
        |> Multi.run(:update_community_article_count, fn _, _ ->
          Communities.update_count_field(community, thread)
        end)
        |> Multi.run(:update_community_inner_id, fn _,
                                                    %{
                                                      create_article: article,
                                                      update_community_article_count: community
                                                    } ->
          Communities.update_inner_id(community, thread, article)
        end)
        |> Multi.run(:update_user_published_meta, fn _, _ ->
          Accounts.Publishes.update_published_states(user, thread)
        end)
        |> Multi.run(:after_events, fn _, %{create_article: article} ->
          Later.run({Events, :emit, [:cite, %{artiment: article}]})
          Later.run({Events, :emit, [:mention, %{artiment: article}]})
          Later.run({Events, :emit, [:audition, %{artiment: article}]})
          Later.run({__MODULE__, :notify_admin_new_article, [article]})
        end)
        |> Multi.run(:log_action, fn _, _ ->
          Statistics.log_publish_action(user)
        end)
        |> Repo.transaction()
        |> result()
      end)
    end
  end

  @spec notify_admin_new_article(map()) :: T.domain_res(term())
  def notify_admin_new_article(%{id: id} = result) do
    target = result.__struct__
    preload = [:community, author: :user]

    with {:ok, article} <- FrontDesk.get(target, id, preload: preload) do
      info = %{
        id: article.id,
        title: article.title,
        digest: Map.get(article, :digest, article.title),
        author_name: article.author.user.nickname,
        community_slug: article.community.slug,
        type:
          result.__struct__ |> to_string |> String.split(".") |> List.last() |> String.downcase()
      }

      Email.notify_admin(info, :new_article)
    end
  end

  @spec update(map(), map()) :: T.domain_res(term())
  def update(%{is_archived: true}, _attrs),
    do: raise_error(:archived, "article is archived, can not be edit or delete")

  def update(article, attrs) do
    attrs = attrs |> atom_values_to_upcase() |> normalize_article_enum_attrs()

    Multi.new()
    |> Multi.run(:update_article, fn _, _ ->
      do_update_article(article, attrs)
    end)
    |> Multi.run(:update_document, fn _, %{update_article: update_article} ->
      Document.update(update_article, attrs)
    end)
    |> Multi.run(:set_community_tags, fn _, %{update_article: article} ->
      Communities.overwrite_tags(
        %Community{id: article.community_id},
        article.meta.thread,
        article,
        %{community_tags: Map.get(attrs, :community_tags, [])}
      )
    end)
    |> Multi.run(:update_edit_status, fn _, %{set_community_tags: update_article} ->
      Meta.update_edit_status(update_article)
    end)
    |> Multi.run(:after_events, fn _, %{update_article: update_article} ->
      Later.run({Events, :emit, [:cite, %{artiment: update_article}]})
      Later.run({Events, :emit, [:mention, %{artiment: update_article}]})
      Later.run({Events, :emit, [:audition, %{artiment: update_article}]})
    end)
    |> Repo.transaction()
    |> result()
  end

  @spec ensure_author_exists(User.t()) :: {:ok, Author.t()}
  def ensure_author_exists(%User{} = user) do
    case ORM.find_by(Author, user_id: user.id) do
      {:ok, author} ->
        {:ok, author}

      {:error, _} ->
        %Author{user_id: user.id}
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.unique_constraint(:user_id)
        |> Ecto.Changeset.foreign_key_constraint(:user_id)
        |> Repo.insert()
    end
  end

  defp do_create_article(
         model,
         %{body: _body} = attrs,
         %Author{id: author_id},
         %Community{} = community
       ) do
    threads_name = model |> module_to_atom |> plural

    with {:ok, community} <- ORM.fill_meta(community),
         {:ok, attrs} <- add_digest_attrs(attrs) do
      %{id: community_id, meta: community_meta, slug: community_slug} = community
      inner_id = community_meta |> Map.get(:"#{threads_name}_inner_id_index")

      meta = @default_article_meta |> Map.merge(%{thread: module_to_upcase(model)})

      model.__struct__
      |> model.changeset(attrs |> Map.merge(%{inner_id: inner_id + 1}))
      |> Ecto.Changeset.put_change(:emotions, @default_emotions)
      |> Ecto.Changeset.put_change(:author_id, author_id)
      |> Ecto.Changeset.put_change(:community_id, community_id)
      |> Ecto.Changeset.put_change(:community_slug, community_slug)
      |> Ecto.Changeset.put_embed(:meta, meta)
      |> Repo.insert()
    end
  end

  defp do_update_article(article, %{body: _} = attrs) do
    with {:ok, attrs} <- add_digest_attrs(attrs) do
      ORM.update(article, attrs)
    end
  end

  defp do_update_article(article, attrs), do: ORM.update(article, attrs)

  defp add_digest_attrs(%{body: body} = attrs) when not is_nil(body) do
    with {:ok, parsed} <- Converter.Article.parse_body(body),
         {:ok, digest} <- Converter.Article.parse_digest(parsed.body_map) do
      attrs
      |> Map.merge(%{digest: digest})
      |> done
    end
  end

  defp add_digest_attrs(attrs), do: done(attrs)

  defp normalize_article_enum_attrs(attrs) when is_map(attrs) do
    attrs
    |> normalize_enum_attr(:cat, ArticleEnums.cat_values())
    |> normalize_enum_attr(:state, ArticleEnums.state_values())
  end

  defp normalize_article_enum_attrs(attrs), do: attrs

  defp normalize_enum_attr(attrs, key, allowed) do
    case Map.get(attrs, key) do
      nil ->
        attrs

      value when is_atom(value) ->
        if value in allowed, do: Map.put(attrs, key, value), else: attrs

      value when is_binary(value) ->
        normalized = value |> String.downcase()
        atom = Enum.find(allowed, fn v -> Atom.to_string(v) == normalized end)

        if atom do
          Map.put(attrs, key, atom)
        else
          attrs
        end

      _ ->
        attrs
    end
  end

  defp result({:ok, %{set_active_at_timestamp: result}}), do: {:ok, result}
  defp result({:ok, %{update_edit_status: result}}), do: {:ok, result}
  defp result({:ok, %{update_article: result}}), do: {:ok, result}

  defp result({:error, :create_article, _result, _steps}) do
    {:error, {:create_fails, "create article"}}
  end

  defp result({:error, :update_article, _result, _steps}) do
    {:error, {:update_fails, "update article"}}
  end

  defp result({:error, :mirror_article, _result, _steps}) do
    {:error, {:create_fails, "set community"}}
  end

  defp result({:error, :set_community_flag, _result, _steps}) do
    {:error, {:create_fails, "set community flag"}}
  end

  defp result({:error, :log_action, _result, _steps}) do
    {:error, {:create_fails, "log action"}}
  end

  defp result({:error, _, result, _steps}), do: {:error, result}
end
