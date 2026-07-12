defmodule GroupherServer.CMS.Articles.Write do
  @moduledoc """
  Owns non-versioned Article mutations and publish-adjacent helpers.

      Draft / Publish modules
              |
              +--> ensure Author / notify first publish

      public runtime Article
              |
              +--> mark-delete / restore / permanent delete

  Content creation and editing deliberately do not live here. They must pass
  through Draft and Publish so every public change receives a Snapshot.
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.Matcher
  import Helper.ErrorCode

  import Helper.Utils,
    only: [
      done: 1
    ]

  alias GroupherServer.{Accounts, CMS, Messaging, Repo}

  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles.Document
  alias CMS.Communities.TagStats
  alias CMS.Model.Author
  alias CMS.{Assets, Communities, Covers, FrontDesk}
  alias Helper.{Constant, Multi, ORM, T, Transaction}

  @remove_article_hint "The content does not comply with the community norms"
  @audit_illegal Constant.CMS.pending(:illegal)

  @doc "Notifies community administrators after the first official Article publish."
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

  @doc "Returns or creates the CMS Author row associated with a User."
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

  @doc "Marks an Article as deleted while preserving its row for moderation flows."
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

  @doc "Restores an Article previously marked as deleted."
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

  @doc "Marks multiple public Articles as deleted by product inner ids."
  @spec batch_mark_delete(String.t(), atom(), [T.id()]) :: T.domain_res(term())
  def batch_mark_delete(community, thread, inner_id_list) do
    do_batch_mark_delete(community, thread, inner_id_list, true)
  end

  @doc "Restores multiple public Articles by product inner ids."
  @spec batch_undo_mark_delete(String.t(), atom(), [T.id()]) :: T.domain_res(term())
  def batch_undo_mark_delete(community, thread, inner_id_list) do
    do_batch_mark_delete(community, thread, inner_id_list, false)
  end

  @doc "Permanently deletes an Article and its owned projections."
  @spec delete(term()) :: T.domain_res(term())
  def delete(article) do
    delete(article, @remove_article_hint)
  end

  @doc "Permanently deletes an Article while accepting a product audit reason."
  @spec delete(term(), String.t()) :: T.domain_res(term())
  def delete(article, _reason) do
    article = Repo.preload(article, [:communities, :community_tags, [author: :user]])
    {:ok, thread} = FrontDesk.thread_of(article)

    Multi.new()
    |> Multi.run(:purge_mentions, fn _, _ ->
      CMS.ArtimentMentions.purge(article)
    end)
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
      with {:ok, _} <- Assets.purge_article_refs(thread, article.id) do
        Document.remove(thread, article.id)
        {:ok, :pass}
      end
    end)
    |> Multi.run(:delete_cover, fn _, _ ->
      Covers.delete_cover_edit_info(article.cover_edit_info_id)
    end)
    |> Repo.transaction()
    |> result()
  end

  defp do_batch_mark_delete(community, thread, inner_id_list, delete_flag) do
    with {:ok, info} <- match(thread) do
      batch_query =
        info.model
        |> join(:inner, [article], c in assoc(article, :community))
        |> where([_article, c], c.slug == ^community)
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

  defp result({:ok, %{update_edit_status: result}}), do: {:ok, result}
  defp result({:ok, %{update_article: result}}), do: {:ok, result}
  defp result({:ok, %{delete_article: result}}), do: {:ok, result}
  defp result({:ok, %{update_articles: _result}}), do: {:ok, %{done: true}}

  defp result({:error, :update_article, _result, _steps}) do
    {:error, {:update_fails, "update article"}}
  end

  defp result({:error, :set_community_flag, _result, _steps}) do
    {:error, {:create_fails, "set community flag"}}
  end

  defp result({:error, _, result, _steps}), do: {:error, result}
end
