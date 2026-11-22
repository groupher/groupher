defmodule GroupherServer.CMS.DocTree.Publish.Approval do
  @moduledoc """
  Freezes one approved Docs Queue plan and its exact content snapshots.

      admitted approval -> locked Queue and public baseline -> snapshots + author set -> sealed approval

  The caller owns Gate, Receipt, notifications, and rollback on all
  errors. This is not a public approval command.
  """

  import Ecto.Query
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.{Publishable, WorkingCopy.Snapshotter}
  alias CMS.DocTree.Publish.{Affected, Lifecycle, Plan, Queue, TargetTree, TreeCodec}
  alias CMS.DocTree.Publish.Queue.Dequeue

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticlePublic,
    ArticleSnapshot,
    Community,
    DocsPublishApproval,
    DocsPublishApprovalArticle,
    DocsPublishApprovalContributor,
    DocsPublishQueue,
    DocsQueueArticle,
    DocsQueueArticleContributor,
    DocsQueueTreeChange,
    DocsQueueTreeContributor,
    DocsRelease,
    DocsReleaseTreeSnapshot,
    DocsTreeNode
  }

  @fields ~w(node_id type parent_node_id index title href doc_id marker badge hidden)a

  @doc "Approves the current complete Queue, freezing snapshots and active contributors."
  def approve(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        revision,
        %User{id: actor_id} = actor,
        command_id,
        operation_ref
      )
      when is_integer(revision) and revision >= 0 and is_integer(actor_id) and actor_id > 0 and
             is_binary(operation_ref) do
    with {:ok, operation_ref} <- Ecto.UUID.cast(operation_ref),
         {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: revision}, []),
         true <- queue.approval_required,
         %User{} <- Repo.get(User, actor_id),
         ids <-
           Repo.all(
             from(m in DocsQueueArticle,
               where: m.queue_id == ^queue.id,
               order_by: m.article_id,
               select: m.article_id
             )
           ),
         changes <-
           Repo.all(
             from(c in DocsQueueTreeChange,
               where: c.queue_id == ^queue.id,
               order_by: c.node_id,
               lock: "FOR UPDATE"
             )
           ),
         true <- ids != [] or changes != [],
         {:ok, affected} <- Affected.lock(community, ids, changes),
         {:ok, locked} <- lock_content(community, queue, ids),
         {:ok, _lifecycles} <-
           Lifecycle.lock(community, affected.article_ids -- affected.deleted, affected.deleted),
         {:ok, plan} <- build_plan(community, queue, locked.rows, changes),
         authors <- contributors(queue.id),
         false <- not queue.allow_self_approval and actor_id in authors,
         {:ok, snapshots} <- freeze_members(locked.rows, actor, command_id),
         {:ok, approval} <-
           %DocsPublishApproval{}
           |> DocsPublishApproval.changeset(%{
             community_id: community.id,
             queue_id: queue.id,
             queue_revision: revision,
             approval_policy_revision: queue.approval_policy_revision,
             allow_self_approval: queue.allow_self_approval,
             base_release_id: queue.public_release_id,
             plan_format_version: plan.format_version,
             tree_plan: Plan.storage(plan.payload),
             approved_by_id: actor_id,
             approved_at: DateTime.utc_now(:second)
           })
           |> Repo.insert(),
         {:ok, :pass} <- insert_members(approval.id, snapshots, authors),
         {:ok, approval} <- approval |> Ecto.Changeset.change(sealed: true) |> Repo.update(),
         {:ok, queue} <-
           queue |> Ecto.Changeset.change(latest_approval_id: approval.id) |> Repo.update(),
         {:ok, _} <- CMS.DocTree.Publication.Notifications.approved(queue, operation_ref) do
      {:ok, %{approval: approval, queue: queue, plan: plan}}
    else
      :error -> {:error, :invalid_docs_approval}
      nil -> {:error, :invalid_queue_actor}
      false -> {:error, :docs_approval_not_allowed}
      true -> {:error, :docs_self_approval_forbidden}
      {:error, _reason} = error -> error
    end
  end

  def approve(_, _, _, _, _, _), do: {:error, :invalid_docs_approval}

  @doc "Checks fixed approval Snapshot identities and sources against the rebuilt queue plan."
  def matches_sources?(approval, plan) do
    members =
      Repo.all(
        from(m in DocsPublishApprovalArticle,
          join: snapshot in ArticleSnapshot,
          on: snapshot.id == m.snapshot_id and snapshot.article_id == m.article_id,
          where: m.approval_id == ^approval.id,
          order_by: m.article_id,
          select: %{
            "article_id" => m.article_id,
            "working_copy_id" => snapshot.source_working_copy_id,
            "revision" => snapshot.source_revision
          }
        )
      )

    approval.base_release_id === plan.payload["base_release_id"] and
      members === plan.payload["articles"]
  end

  defp lock_content(_community, _queue, []), do: {:ok, %{rows: []}}
  defp lock_content(community, queue, ids), do: Dequeue.load_locked(community, queue, ids)

  @doc false
  def build_plan(community, queue, rows, changes) do
    build_plan(community, queue, rows, changes, :locked)
  end

  @doc false
  def build_plan(community, queue, rows, changes, mode) when mode in [:locked, :snapshot] do
    public =
      from(n in DocsTreeNode,
        where: n.community_id == ^community.id and n.stage == :public,
        order_by: n.node_id
      )
      |> maybe_lock(mode)
      |> Repo.all()
      |> Enum.map(&Map.take(&1, @fields))

    public_ids =
      Repo.all(
        from(p in ArticlePublic,
          join: a in Article,
          on: a.id == p.article_id,
          join: b in ArticleBinding,
          on: b.article_id == a.id and b.community_id == ^community.id,
          where: a.thread == :doc and b.thread == :doc,
          select: a.id
        )
      )

    members =
      Enum.map(rows, fn row ->
        %{article_id: row.article.id, working_copy_id: row.copy.id, revision: row.copy.revision}
      end)

    with {:ok, public} <- TargetTree.build(public, []),
         {:ok, :pass} <- check_baseline(community.id, queue.public_release_id, public, mode),
         {:ok, changes} <- TreeCodec.decode_changes(changes),
         {:ok, plan} <- Plan.build(queue.public_release_id, public, changes, members, public_ids) do
      {:ok, plan}
    end
  end

  defp check_baseline(_community_id, nil, [], _mode), do: {:ok, :pass}

  defp check_baseline(community_id, id, public, mode) when is_integer(id) do
    tree =
      from(r in DocsRelease,
        join: s in DocsReleaseTreeSnapshot,
        on: s.id == r.tree_snapshot_id,
        where:
          r.id == ^id and r.community_id == ^community_id and
            s.community_id == ^community_id and r.sealed == true,
        select: s.tree_json
      )
      |> maybe_lock(mode)
      |> Repo.one()

    with {:ok, nodes} <- TreeCodec.decode(tree), true <- nodes == public do
      {:ok, :pass}
    else
      _ -> {:error, :docs_release_baseline_mismatch}
    end
  end

  defp check_baseline(_, _, _, _), do: {:error, :docs_release_baseline_mismatch}

  defp maybe_lock(query, :locked), do: lock(query, "FOR SHARE")
  defp maybe_lock(query, :snapshot), do: query

  defp contributors(queue_id) do
    article_authors =
      Repo.all(
        from(c in DocsQueueArticleContributor, where: c.queue_id == ^queue_id, select: c.user_id)
      )

    tree_authors =
      Repo.all(
        from(c in DocsQueueTreeContributor, where: c.queue_id == ^queue_id, select: c.user_id)
      )

    (article_authors ++ tree_authors) |> Enum.uniq() |> Enum.sort()
  end

  defp freeze_members(rows, actor, command_id) do
    Enum.reduce_while(rows, {:ok, []}, fn row, {:ok, result} ->
      with {:ok, :pass} <- Publishable.validate(row.copy),
           {:ok, snapshot} <- Snapshotter.freeze_locked(row.article, row.copy, actor, command_id) do
        {:cont, {:ok, [%{article_id: row.article.id, snapshot_id: snapshot.id} | result]}}
      else
        {:error, _reason} = error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, snapshots} -> {:ok, Enum.reverse(snapshots)}
      error -> error
    end
  end

  defp insert_members(approval_id, snapshots, authors) do
    Repo.insert_all(
      DocsPublishApprovalArticle,
      Enum.map(snapshots, &Map.put(&1, :approval_id, approval_id))
    )

    Repo.insert_all(
      DocsPublishApprovalContributor,
      Enum.map(authors, &%{approval_id: approval_id, user_id: &1})
    )

    {:ok, :pass}
  end
end
