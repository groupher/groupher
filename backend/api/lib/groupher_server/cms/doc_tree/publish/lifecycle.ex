defmodule GroupherServer.CMS.DocTree.Publish.Lifecycle do
  @moduledoc """
  Applies Doc lifecycle transitions within an admitted Queue Release transaction.

    The caller holds the site lock and sorted Article locks and must roll back on error.

      QueueRelease -> Lifecycle -> Doc lifecycle transitions
  """

  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{ArticleBinding, ArticleLifecycle, Community}

  @doc "Locks and validates the lifecycle of every affected Doc in Article order."
  def lock(%Community{id: community_id}, published_ids, deleted_ids) do
    ids = Enum.sort(Enum.uniq(published_ids ++ deleted_ids))

    rows =
      Repo.all(
        from(l in ArticleLifecycle,
          join: b in ArticleBinding,
          on: b.article_id == l.article_id and b.community_id == ^community_id,
          where: l.thread == :doc and l.article_id in ^ids,
          order_by: l.article_id,
          lock: "FOR UPDATE"
        )
      )

    by_article = Map.new(rows, &{&1.article_id, &1})

    cond do
      not MapSet.disjoint?(MapSet.new(published_ids), MapSet.new(deleted_ids)) ->
        {:error, :doc_lifecycle_conflicting_changes}

      length(rows) != length(ids) ->
        {:error, :invalid_doc_lifecycle}

      Enum.any?(published_ids, &(by_article[&1].state not in [:draft, :published])) ->
        {:error, :doc_lifecycle_not_publishable}

      Enum.any?(deleted_ids, &(by_article[&1].state != :published)) ->
        {:error, :doc_lifecycle_not_public}

      true ->
        {:ok, by_article}
    end
  end

  @doc "Moves a first publication from draft to published and checks subsequent publications."
  def published(%ArticleLifecycle{state: :draft} = lifecycle, _first_publish?, _now) do
    CMS.Articles.Lifecycle.transition(lifecycle, :published)
  end

  def published(%ArticleLifecycle{state: :published} = lifecycle, false, _now) do
    {:ok, lifecycle}
  end

  def published(_, _, _), do: {:error, :doc_lifecycle_public_mismatch}

  @doc "Moves an existing public Doc to deleted when its removal is released."
  def deleted(%ArticleLifecycle{state: :published} = lifecycle, _now) do
    CMS.Articles.Lifecycle.transition(lifecycle, :deleted)
  end

  def deleted(_, _), do: {:error, :doc_lifecycle_not_public}
end
