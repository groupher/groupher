defmodule GroupherServer.CMS.Articles.Moderation do
  @moduledoc """
  Article moderation helpers.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Moderation
        -> Repo / domain event
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]
  import ShortMaps

  alias GroupherServer.{CMS, FrontDesk, Repo}

  alias CMS.Articles.Trash
  alias CMS.Communities.TagStats

  alias CMS.Model.{
    Article,
    ArticleCommunity,
    ArticleCommunityTag,
    ArticlePublic,
    CommunityTag,
    DocBranch,
    DocBranchState,
    DocPublic
  }

  alias CMS.SearchArtiments.Indexer
  alias Helper.{ORM, T}

  @doc """
  Returns a paged list of audit-failed articles for one thread.

  ## Examples

      CMS.Articles.Moderation.paged_audit_failed(:post, %{page: 1, size: 20})

  """
  @spec paged_audit_failed(atom(), map()) :: T.domain_res(term())
  def paged_audit_failed(thread, filter) do
    %{page: page, size: size} = filter

    Article
    |> Trash.not_trashed_scope(thread)
    |> where([article], article.thread == ^thread and article.moderation_state == :audit_failed)
    |> order_by([article], desc: article.updated_at)
    |> ORM.paginator(~m(page size)a)
    |> done()
  end

  @doc "Applies one moderation state to a Gate-authorized stable Article."
  @spec set_state(Article.t(), atom(), map(), keyword()) :: T.domain_res(term())
  def set_state(%Article{thread: :doc} = article, state, audit_state, opts)
      when state in [:legal, :illegal, :audit_failed] do
    update_doc_moderation(article, state, audit_state, opts)
  end

  def set_state(%Article{} = article, state, audit_state, opts)
      when state in [:legal, :illegal, :audit_failed] do
    update_stable_moderation(article, state, audit_state, opts)
  end

  defp update_doc_moderation(article, state, audit_state, opts) do
    branch =
      case Keyword.get(opts, :branch_id) do
        nil -> Repo.get_by(DocBranch, community_id: article.community_id, type: :main)
        branch_id -> Repo.get_by(DocBranch, id: branch_id, community_id: article.community_id)
      end

    with %DocBranch{id: branch_id} <- branch,
         %DocBranchState{} = branch_state <-
           Repo.get_by(DocBranchState, article_id: article.id, branch_id: branch_id) do
      with {:ok, updated} <-
             branch_state
             |> DocBranchState.changeset(doc_moderation_attrs(state, audit_state))
             |> Repo.update(),
           :ok <- update_doc_visibility(article.id, branch_id, state),
           :ok <- update_author_moderation(article, state, audit_state),
           :ok <- sync_stable_search(article, state) do
        {:ok, updated}
      end
    else
      nil -> {:error, CMS.Articles.ErrorCat.article_not_found("article not found")}
    end
  end

  defp update_stable_moderation(%Article{} = article, state, audit_state, opts) do
    with {:ok, updated} <-
           article
           |> Article.changeset(stable_moderation_attrs(state, audit_state))
           |> Repo.update(),
         :ok <- update_public_visibility(article.id, state),
         :ok <- update_author_moderation(article, state, audit_state),
         :ok <- rebuild_tag_stats(article.id),
         :ok <- sync_stable_search(updated, state),
         :ok <- invalidate_public_cache(updated, opts) do
      {:ok, updated}
    end
  end

  defp stable_moderation_attrs(state, audit_state) do
    %{
      moderation_state: state,
      illegal_reason:
        if(state == :legal, do: [], else: Map.get(audit_state, :illegal_reason, [])),
      illegal_words: if(state == :legal, do: [], else: Map.get(audit_state, :illegal_words, []))
    }
  end

  defp doc_moderation_attrs(state, audit_state) do
    reason = Map.get(audit_state, :illegal_reason)

    %{
      moderation_state: state,
      illegal_reason: if(state == :legal, do: nil, else: reason |> List.wrap() |> List.first()),
      illegal_words: if(state == :legal, do: [], else: Map.get(audit_state, :illegal_words, []))
    }
  end

  defp update_author_moderation(article, state, audit_state) do
    article = Repo.preload(article, author: :user)
    user = article.author.user
    changed = Map.get(audit_state, :illegal_articles, [])

    illegal_articles =
      case state do
        :legal -> user.meta.illegal_articles -- changed
        _ -> Enum.uniq(user.meta.illegal_articles ++ changed)
      end

    case ORM.update_meta(user, %{
           has_illegal_articles: illegal_articles != [],
           illegal_articles: illegal_articles
         }) do
      {:ok, _user} ->
        FrontDesk.revalidate().user(user.login)
        :ok

      {:error, _reason} = error ->
        error
    end
  end

  defp update_public_visibility(article_id, state) do
    ArticlePublic
    |> where([public], public.article_id == ^article_id)
    |> Repo.update_all(set: [visible: state == :legal, updated_at: DateTime.utc_now(:second)])

    ArticleCommunity
    |> where([relation], relation.article_id == ^article_id)
    |> Repo.update_all(set: [visible: state == :legal, updated_at: DateTime.utc_now(:second)])

    :ok
  end

  defp update_doc_visibility(article_id, branch_id, state) do
    DocPublic
    |> where([public], public.article_id == ^article_id and public.branch_id == ^branch_id)
    |> Repo.update_all(set: [visible: state == :legal, updated_at: DateTime.utc_now(:second)])

    :ok
  end

  defp rebuild_tag_stats(article_id) do
    CommunityTag
    |> join(:inner, [tag], assignment in ArticleCommunityTag, on: assignment.tag_id == tag.id)
    |> join(:inner, [_tag, assignment], relation in ArticleCommunity,
      on: relation.id == assignment.article_community_id
    )
    |> where([_tag, _assignment, relation], relation.article_id == ^article_id)
    |> Repo.all()
    |> Enum.reduce_while(:ok, fn tag, :ok ->
      case TagStats.rebuild(tag) do
        {:ok, _stat} -> {:cont, :ok}
        {:error, _reason} = error -> {:halt, error}
      end
    end)
  end

  defp sync_stable_search(article, :legal) do
    _ = Indexer.enqueue_upsert(article)
    :ok
  end

  defp sync_stable_search(article, _state) do
    _ = Indexer.enqueue_delete(article)
    :ok
  end

  defp invalidate_public_cache(%Article{inner_id: inner_id}, _opts)
       when not is_integer(inner_id),
       do: :ok

  defp invalidate_public_cache(%Article{} = article, opts) do
    operation_id = Keyword.get(opts, :command_id, Ecto.UUID.generate())

    article
    |> CMS.Articles.Communities.communities()
    |> Enum.reduce_while(:ok, fn community, :ok ->
      case CMS.Outbox.send(%{
             event: "article.visibility_changed",
             worker: CMS.Outbox.Workers.Article.Cleanup,
             resource_type: "article",
             resource_id: article.id,
             command_id: Ecto.UUID.generate(),
             data: %{
               operation_id: operation_id,
               community: community.slug,
               community_id: community.id,
               thread: article.thread,
               inner_id: article.inner_id,
               article_id: article.id
             }
           }) do
        {:ok, _event} -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end
end
