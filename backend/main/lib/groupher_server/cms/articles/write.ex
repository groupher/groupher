defmodule GroupherServer.CMS.Articles.Write do
  @moduledoc """
  Article write helpers.
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.Matcher
  import Helper.ErrorCode

  import Helper.Utils,
    only: [
      done: 1,
      plural: 1,
      module_to_atom: 1
    ]

  alias GroupherServer.{Accounts, CMS, Messaging, Repo, Statistics}

  alias Accounts.Model.User
  alias CMS.Articles.{Document, States}
  alias CMS.Communities.TagStats
  alias CMS.Model.{Author, Community, Embeds}
  alias CMS.{Communities, Events, FrontDesk}
  alias Helper.{Constant, ContentPipeline, Multi, Later, ORM, T, Transaction}

  @default_emotions Embeds.ArticleEmotion.default_emotions()
  @default_article_meta Embeds.ArticleMeta.default_meta()
  @remove_article_hint "The content does not comply with the community norms"
  @audit_illegal Constant.CMS.pending(:illegal)

  @spec create(Community.t(), atom(), map(), User.t()) :: T.domain_res(term())
  def create(%Community{} = community, thread, attrs, %User{} = user) do
    with {:ok, attrs} <- attrs |> attach_content_payload(),
         {:ok, author} <- ensure_author_exists(user),
         {:ok, info} <- match(thread) do
      Transaction.lock_row(community, fn community ->
        Multi.new()
        |> Multi.run(:create_article, fn _, _ ->
          do_create_article(info.model, attrs, author, community)
        end)
        |> Multi.run(:create_document, fn _, %{create_article: article} ->
          Document.create(article, attrs)
        end)
        |> Multi.run(:mirror_article, fn _, %{create_article: article} ->
          States.mirror(community, article)
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
          Accounts.Publish.update_states(user, thread)
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

      Messaging.notify(:notify_admin_new_article, info)
    end
  end

  @spec update(map(), map()) :: T.domain_res(term())
  def update(%{is_archived: true}, _attrs),
    do: raise_error(:archived, "article is archived, can not be edit or delete")

  def update(article, attrs) do
    with {:ok, attrs} <-
           attrs
           |> attach_content_payload() do
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
        States.update_edit_status(update_article)
      end)
      |> Multi.run(:finalize_article, fn _,
                                         %{
                                           set_community_tags: tagged_article,
                                           update_edit_status: updated_article
                                         } ->
        {:ok, merge_loaded_assoc(updated_article, :community_tags, tagged_article)}
      end)
      |> Multi.run(:after_events, fn _, %{update_article: update_article} ->
        Later.run({Events, :emit, [:cite, %{artiment: update_article}]})
        Later.run({Events, :emit, [:mention, %{artiment: update_article}]})
        Later.run({Events, :emit, [:audition, %{artiment: update_article}]})
      end)
      |> Repo.transaction()
      |> result()
    end
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

  @spec mark_delete(term()) :: T.domain_res(term())
  def mark_delete(article) do
    {:ok, thread} = FrontDesk.thread_of(article)
    article = Repo.preload(article, :community_tags)

    Transaction.lock_row(article, fn article ->
      case article.is_archived do
        false ->
          Multi.new()
          |> Multi.run(:update_article, fn _, _ ->
            ORM.update(article, %{mark_delete: true})
          end)
          |> Multi.run(:update_tag_stats, fn _, %{update_article: updated_article} ->
            update_tag_stats_on_visibility_change(article, updated_article)
          end)
          |> Multi.run(:update_community_article_count, fn _, _ ->
            Communities.update_count_field(article.communities, thread)
          end)
          |> Repo.transaction()
          |> result()

        true ->
          raise_error(:archived, "article is archived, can not be edit or delete")
      end
    end)
  end

  @spec undo_mark_delete(term()) :: T.domain_res(term())
  def undo_mark_delete(article) do
    {:ok, thread} = FrontDesk.thread_of(article)
    article = Repo.preload(article, :community_tags)

    Transaction.lock_row(article, fn article ->
      Multi.new()
      |> Multi.run(:update_article, fn _, _ ->
        ORM.update(article, %{mark_delete: false})
      end)
      |> Multi.run(:update_tag_stats, fn _, %{update_article: updated_article} ->
        update_tag_stats_on_visibility_change(article, updated_article)
      end)
      |> Multi.run(:update_community_article_count, fn _, _ ->
        Communities.update_count_field(article.communities, thread)
      end)
      |> Repo.transaction()
      |> result()
    end)
  end

  @spec batch_mark_delete(String.t(), atom(), [T.id()]) :: T.domain_res(term())
  def batch_mark_delete(community, thread, inner_id_list) do
    do_batch_mark_delete(community, thread, inner_id_list, true)
  end

  @spec batch_undo_mark_delete(String.t(), atom(), [T.id()]) :: T.domain_res(term())
  def batch_undo_mark_delete(community, thread, inner_id_list) do
    do_batch_mark_delete(community, thread, inner_id_list, false)
  end

  @spec delete(term()) :: T.domain_res(term())
  def delete(article) do
    delete(article, @remove_article_hint)
  end

  @spec delete(term(), String.t()) :: T.domain_res(term())
  def delete(article, _reason) do
    article = Repo.preload(article, [:communities, :community_tags, [author: :user]])
    {:ok, thread} = FrontDesk.thread_of(article)

    Multi.new()
    |> Multi.run(:delete_article, fn _, _ ->
      article |> ORM.delete()
    end)
    |> Multi.run(:update_tag_stats, fn _, _ ->
      update_tag_stats_on_visibility_change(article, %{article | mark_delete: true})
    end)
    |> Multi.run(:update_community_article_count, fn _, _ ->
      Communities.update_count_field(article.communities, thread)
    end)
    |> Multi.run(:update_user_published_meta, fn _, _ ->
      Accounts.Publish.update_states(article.author.user, thread)
    end)
    |> Multi.run(:delete_document, fn _, _ ->
      Document.remove(thread, article.id)
      {:ok, :pass}
    end)
    |> Repo.transaction()
    |> result()
  end

  defp do_create_article(
         model,
         attrs,
         %Author{id: author_id},
         %Community{} = community
       ) do
    threads_name = model |> module_to_atom |> plural

    with {:ok, community} <- ORM.fill_meta(community),
         {:ok, attrs} <- attrs |> ensure_body_from_payload() |> add_digest_attrs() do
      %{id: community_id, meta: community_meta, slug: community_slug} = community
      inner_id = community_meta |> Map.get(:"#{threads_name}_inner_id_index")

      meta = @default_article_meta |> Map.merge(%{thread: module_to_atom(model)})

      struct(model)
      |> model.changeset(attrs |> Map.merge(%{inner_id: inner_id + 1}))
      |> Ecto.Changeset.put_change(:emotions, @default_emotions)
      |> Ecto.Changeset.put_change(:author_id, author_id)
      |> Ecto.Changeset.put_change(:community_id, community_id)
      |> Ecto.Changeset.put_change(:community_slug, community_slug)
      |> Ecto.Changeset.put_embed(:meta, meta)
      |> Repo.insert()
    end
  end

  defp do_update_article(article, attrs) do
    with {:ok, attrs} <- attrs |> ensure_body_from_payload() |> add_digest_attrs() do
      ORM.update(article, attrs)
    end
  end

  defp add_digest_attrs(%{content_payload: %{digest: digest}} = attrs) do
    attrs |> Map.merge(%{digest: digest}) |> done
  end

  defp add_digest_attrs(%{body: body} = attrs) when not is_nil(body) do
    with %{content_payload: %{digest: digest}} <- attrs do
      attrs |> Map.merge(%{digest: digest}) |> done
    else
      _ ->
        with {:ok, payload} <- ContentPipeline.parse(%{body: body}) do
          attrs
          |> Map.put(:content_payload, payload)
          |> Map.put(:digest, payload.digest)
          |> done
        end
    end
  end

  defp add_digest_attrs(attrs), do: done(attrs)

  defp ensure_body_from_payload(%{body: body} = attrs) when is_binary(body), do: attrs

  defp ensure_body_from_payload(%{content_payload: %{json: json}} = attrs) when is_binary(json) do
    Map.put(attrs, :body, json)
  end

  defp ensure_body_from_payload(attrs), do: attrs

  defp attach_content_payload(%{content_payload: %{} = _payload} = attrs), do: done(attrs)

  defp attach_content_payload(%{body: body} = attrs) when is_binary(body) do
    with {:ok, payload} <- ContentPipeline.parse(%{body: body}) do
      attrs
      |> Map.put(:content_payload, payload)
      |> done
    end
  end

  defp attach_content_payload(attrs), do: done(attrs)

  defp do_batch_mark_delete(community, thread, inner_id_list, delete_flag) do
    with {:ok, info} <- match(thread) do
      batch_query =
        info.model
        |> where([article], article.community_slug == ^community)
        |> where([article], article.inner_id in ^inner_id_list)

      Multi.new()
      |> Multi.run(:list_articles, fn _, _ ->
        batch_query
        |> preload(:community_tags)
        |> Repo.all()
        |> done()
      end)
      |> Multi.run(:update_articles, fn _, _ ->
        batch_query
        |> Repo.update_all(set: [mark_delete: delete_flag])
        |> done
      end)
      |> Multi.run(:update_tag_stats, fn _, %{list_articles: articles} ->
        articles
        |> Enum.map(fn article -> {article, %{article | mark_delete: delete_flag}} end)
        |> update_articles_tag_stats()
      end)
      |> Multi.run(:update_community_article_count, fn _, _ ->
        communities =
          from(a in batch_query, preload: :communities)
          |> Repo.all()
          |> Enum.map(& &1.communities)
          |> Enum.at(0)

        case communities do
          nil -> {:ok, :pass}
          _ -> Communities.update_count_field(communities, thread)
        end
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  defp merge_loaded_assoc(target, field, source) do
    case Map.get(source, field) do
      %Ecto.Association.NotLoaded{} -> target
      loaded -> Map.put(target, field, loaded)
    end
  end

  defp update_articles_tag_stats(articles) do
    Enum.reduce_while(articles, {:ok, :pass}, fn {article, updated_article}, {:ok, :pass} ->
      case update_tag_stats_on_visibility_change(article, updated_article) do
        {:ok, :pass} -> {:cont, {:ok, :pass}}
        error -> {:halt, error}
      end
    end)
  end

  defp update_tag_stats_on_visibility_change(article, updated_article) do
    case {counted_in_tag_stats?(article), counted_in_tag_stats?(updated_article)} do
      {true, false} -> update_tag_stats(article, :dec)
      {false, true} -> update_tag_stats(updated_article, :inc)
      _ -> {:ok, :pass}
    end
  end

  defp counted_in_tag_stats?(article) do
    Map.get(article, :mark_delete) == false and Map.get(article, :pending) != @audit_illegal
  end

  defp update_tag_stats(article, action) do
    article = Repo.preload(article, :community_tags)

    Enum.reduce_while(article.community_tags, {:ok, :pass}, fn tag, {:ok, :pass} ->
      case apply(TagStats, action, [article, tag]) do
        {:ok, :pass} -> {:cont, {:ok, :pass}}
        error -> {:halt, error}
      end
    end)
  end

  defp result({:ok, %{set_active_at_timestamp: result}}), do: {:ok, result}
  defp result({:ok, %{finalize_article: result}}), do: {:ok, result}
  defp result({:ok, %{update_edit_status: result}}), do: {:ok, result}
  defp result({:ok, %{update_article: result}}), do: {:ok, result}
  defp result({:ok, %{delete_article: result}}), do: {:ok, result}
  defp result({:ok, %{update_articles: _result}}), do: {:ok, %{done: true}}

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
