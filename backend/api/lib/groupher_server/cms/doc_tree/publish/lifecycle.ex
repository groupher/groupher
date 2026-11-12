defmodule GroupherServer.CMS.DocTree.Publish.Lifecycle do
  @moduledoc """
  Applies Doc lifecycle transitions within an admitted Queue Release transaction.

    The caller holds the site lock and sorted Article locks and must roll back on error.

      QueueRelease -> Lifecycle -> Doc lifecycle transitions
  """

  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, DocsLifecycle}

  @doc "Locks and validates the lifecycle of every affected Doc in Article order."
  def lock(%Community{id: community_id}, published_ids, deleted_ids) do
    ids = Enum.sort(Enum.uniq(published_ids ++ deleted_ids))

    rows =
      Repo.all(
        from(l in DocsLifecycle,
          where: l.article_id in ^ids,
          order_by: l.article_id,
          lock: "FOR UPDATE"
        )
      )

    by_article = Map.new(rows, &{&1.article_id, &1})

    cond do
      not MapSet.disjoint?(MapSet.new(published_ids), MapSet.new(deleted_ids)) ->
        {:error, :doc_lifecycle_conflicting_changes}

      length(rows) != length(ids) or Enum.any?(rows, &(&1.community_id != community_id)) ->
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
  def published(%DocsLifecycle{state: :draft} = lifecycle, true, now) do
    first_published_at = lifecycle.first_published_at || now
    transition(lifecycle, %{state: :published, first_published_at: first_published_at}, now)
  end

  def published(%DocsLifecycle{state: :published} = lifecycle, false, _now) do
    {:ok, lifecycle}
  end

  def published(_, _, _), do: {:error, :doc_lifecycle_public_mismatch}

  @doc "Moves an existing public Doc to deleted when its removal is released."
  def deleted(%DocsLifecycle{state: :published} = lifecycle, now) do
    transition(lifecycle, %{state: :deleted, deleted_at: now}, now)
  end

  def deleted(_, _), do: {:error, :doc_lifecycle_not_public}

  defp transition(lifecycle, attrs, now) do
    lifecycle
    |> DocsLifecycle.changeset(
      Map.merge(attrs, %{version: lifecycle.version + 1, changed_at: now})
    )
    |> Repo.update()
  end
end
