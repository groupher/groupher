defmodule GroupherServer.CMS.DocTree.Publish.QueueRead do
  @moduledoc """
  Reads the current Docs Queue after site preview and per-Doc admission.

    Site lock keeps the returned members, tree changes and revision together.

      Docs Queue query -> QueueRead -> Gate / Queue members and tree changes
  """

  require Logger
  import Ecto.Query
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.Publish.{Affected, Approval, ApprovalStatus, Queue, SiteLock}
  alias CMS.DocTree.Publish.Queue.Dequeue

  alias CMS.Model.{
    ArticleWorkingCopy,
    Community,
    DocsPublishApproval,
    DocsQueueArticle,
    DocsQueueTreeChange
  }

  @doc "Reads the authorized complete queue without initializing an empty site."
  def read(%Community{} = community, %User{} = actor) do
    Repo.transact(fn ->
      with {:ok, community} <-
             CMS.Gate.Access.Check.community(actor, :docs_queue_preview, community),
           {:ok, :acquired} <- SiteLock.acquire(community),
           {:ok, queue} <- Queue.read(community),
           {:ok, result} <- load(community, queue, actor) do
        {:ok, result}
      end
    end)
  end

  def read(_, _), do: {:error, :invalid_docs_queue_reader}

  defp load(_community, %{id: nil} = queue, _actor) do
    {:ok, result(queue, [], [], nil)}
  end

  defp load(community, queue, actor) do
    rows =
      Repo.all(
        from(m in DocsQueueArticle,
          join: w in ArticleWorkingCopy,
          on: w.id == m.working_copy_id and w.article_id == m.article_id,
          where: m.queue_id == ^queue.id,
          order_by: m.article_id,
          select: %{
            article_id: m.article_id,
            working_copy_id: w.id,
            revision: w.revision,
            title: w.title
          }
        )
      )

    changes =
      Repo.all(
        from(c in DocsQueueTreeChange,
          where: c.queue_id == ^queue.id,
          order_by: c.node_id
        )
      )

    ids = Enum.map(rows, & &1.article_id)

    with {:ok, affected} <- Affected.lock(community, ids, changes),
         {:ok, :pass} <- authorize(community, affected.article_ids, actor),
         {:ok, status} <- approval_status(community, queue, ids, changes) do
      {:ok, result(queue, rows, changes, status)}
    end
  end

  defp result(queue, rows, changes, status) do
    %{
      revision: queue.queue_revision,
      articles: rows,
      tree_changes: changes,
      approval_status: status,
      approval_required: queue.approval_required,
      allow_self_approval: queue.allow_self_approval,
      approval_policy_revision: queue.approval_policy_revision
    }
  end

  defp approval_status(community, queue, ids, changes) do
    approval =
      if queue.latest_approval_id, do: Repo.get(DocsPublishApproval, queue.latest_approval_id)

    input = %{
      approval_required: queue.approval_required,
      allow_self_approval: queue.allow_self_approval,
      has_members: ids != [] or changes != [],
      queue_revision: queue.queue_revision,
      approval_policy_revision: queue.approval_policy_revision
    }

    with true <-
           is_nil(approval) or
             (approval.sealed and approval.queue_id == queue.id and
                approval.community_id == community.id),
         {:ok, %{status: status, consistency_error: consistency_error?}} <-
           ApprovalStatus.derive(input, approval, [1], fn ->
             with {:ok, locked} <- Dequeue.load_locked(community, queue, ids),
                  {:ok, plan} <- Approval.build_plan(community, queue, locked.rows, changes) do
               if Approval.matches_sources?(approval, plan) do
                 {:ok, plan}
               else
                 {:error, :approval_facts_mismatch}
               end
             end
           end) do
      if consistency_error? do
        Logger.error("Docs approval plan mismatch",
          community_id: community.id,
          queue_id: queue.id,
          queue_revision: queue.queue_revision
        )
      end

      {:ok, status}
    else
      false -> {:error, :invalid_docs_approval}
      {:error, _} = error -> error
    end
  end

  defp authorize(community, ids, actor) do
    with {:ok, context} <- CMS.Gate.Access.Load.community(actor, community) do
      visible = CMS.Gate.Scope.DocsContent.query(actor, context, :preview)
      admitted = Repo.all(from(a in visible, where: a.id in ^ids, select: a.id))

      if Enum.sort(admitted) == Enum.sort(ids) do
        {:ok, :pass}
      else
        {:error, CMS.Gate.ErrorCat.permission_denied()}
      end
    end
  end
end
