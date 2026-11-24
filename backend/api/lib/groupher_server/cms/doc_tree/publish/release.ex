defmodule GroupherServer.CMS.DocTree.Publish.Release do
  @moduledoc """
  Records a checked Docs publication as a sealed site Release.

      locked Queue + verified plan and public heads -> immutable tree + members -> Release

  The enclosing command owns authorization, planner input and approval checks,
  public tree and Lifecycle writes, D alignment, Queue consumption, Receipt,
  effects and rollback. This step does not independently publish a site.
  """

  require Logger
  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.Publish.{Approval, ApprovalStatus, Queue, TreeCodec, TreeOperations}

  alias CMS.Model.{
    ArticleBinding,
    ArticlePublic,
    ArticleSnapshot,
    ArticleWorkingCopy,
    Community,
    DocsPublishQueue,
    DocsPublishApproval,
    DocsPublishApprovalArticle,
    DocsQueueArticle,
    DocsRelease,
    DocsReleaseArticle,
    DocsReleaseTreeSnapshot,
    DocsQueueTreeChange
  }

  @doc "Records and seals one verified plan and its actual publication members."
  def record(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        revision,
        plan,
        publications,
        deletions,
        approval_id,
        %User{id: user_id} = actor,
        %DateTime{} = published_at
      )
      when is_integer(revision) and revision >= 0 and is_map(plan) and is_list(publications) and
             is_list(deletions) and (is_nil(approval_id) or is_binary(approval_id)) and
             is_integer(user_id) and user_id > 0 and published_at.utc_offset == 0 and
             published_at.std_offset == 0 do
    with {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: revision}, []),
         %User{} <- Repo.get(User, user_id),
         {:ok, :pass} <- validate_plan(queue, plan),
         {:ok, publications} <- normalize_publications(publications),
         {:ok, deletions} <- normalize_deletions(deletions),
         {:ok, :pass} <- validate_approval(queue, plan, publications, approval_id),
         {:ok, :pass} <- validate_members(community, queue, plan, publications, deletions),
         {:ok, tree_json} <- TreeCodec.encode(plan.target),
         {:ok, tree} <-
           %DocsReleaseTreeSnapshot{}
           |> DocsReleaseTreeSnapshot.changeset(%{
             community_id: community.id,
             tree_json: tree_json,
             created_at: published_at
           })
           |> Repo.insert(),
         {:ok, release} <-
           %DocsRelease{}
           |> DocsRelease.changeset(%{
             community_id: community.id,
             tree_snapshot_id: tree.id,
             queue_revision: revision,
             base_release_id: queue.public_release_id,
             approval_id: approval_id,
             plan_format_version: plan.format_version,
             published_by_id: actor.id,
             published_at: published_at
           })
           |> Repo.insert(),
         {:ok, :pass} <- insert_members(release.id, publications, deletions),
         {:ok, release} <- release |> Ecto.Changeset.change(sealed: true) |> Repo.update(),
         {:ok, queue} <-
           queue |> Ecto.Changeset.change(public_release_id: release.id) |> Repo.update() do
      {:ok, %{release: release, tree_snapshot: tree, queue: queue}}
    else
      nil -> {:error, :invalid_queue_actor}
      {:error, _reason} = error -> error
    end
  end

  def record(_, _, _, _, _, _, _, _, _), do: {:error, :invalid_docs_release}

  @doc "Verifies that the release's captured approval matches the Queue policy, plan, and publications."
  def validate_approval(%DocsPublishQueue{approval_required: false}, _plan, _publications, nil) do
    {:ok, :pass}
  end

  def validate_approval(%DocsPublishQueue{approval_required: false}, _, _, _) do
    {:error, :unexpected_docs_approval}
  end

  def validate_approval(
        %DocsPublishQueue{approval_required: true} = queue,
        plan,
        publications,
        id
      )
      when is_binary(id) do
    with {:ok, id} <- Ecto.UUID.cast(id),
         true <- id == queue.latest_approval_id,
         %DocsPublishApproval{sealed: true} = approval <-
           Repo.one(
             from(a in DocsPublishApproval,
               where:
                 a.id == ^id and a.queue_id == ^queue.id and a.community_id == ^queue.community_id,
               lock: "FOR SHARE"
             )
           ),
         true <- approval.base_release_id == queue.public_release_id,
         status_input = %{
           approval_required: true,
           allow_self_approval: queue.allow_self_approval,
           has_members: true,
           queue_revision: queue.queue_revision,
           approval_policy_revision: queue.approval_policy_revision
         },
         {:ok, %{status: :approved}} <-
           ApprovalStatus.derive(status_input, approval, [1], fn ->
             if Approval.matches_sources?(approval, plan) do
               {:ok, plan}
             else
               {:error, :approval_facts_mismatch}
             end
           end),
         approved <-
           Repo.all(
             from(a in DocsPublishApprovalArticle,
               where: a.approval_id == ^id,
               order_by: a.article_id,
               select: {a.article_id, a.snapshot_id},
               lock: "FOR SHARE"
             )
           ),
         expected <-
           publications
           |> Enum.map(fn {article_id, item} -> {article_id, item.snapshot_id} end)
           |> Enum.sort(),
         true <- approved == expected do
      {:ok, :pass}
    else
      {:ok, %{consistency_error: true}} ->
        Logger.error("Docs approval facts mismatch during release",
          community_id: queue.community_id,
          queue_id: queue.id,
          queue_revision: queue.queue_revision
        )

        {:error, :docs_approval_required}

      _ ->
        {:error, :docs_approval_required}
    end
  end

  def validate_approval(_, _, _, _), do: {:error, :docs_approval_required}

  defp validate_plan(queue, %{
         format_version: 1,
         payload:
           %{"base_release_id" => base, "plan_format_version" => 1, "articles" => articles} =
             payload,
         target: target
       })
       when is_list(articles) and is_list(target) do
    with true <- base === queue.public_release_id,
         true <-
           Enum.sort(Map.keys(payload)) ==
             ~w(articles base_release_id plan_format_version public_tree tree_operations),
         {:ok, :pass} <- validate_baseline(queue, payload["public_tree"]),
         {:ok, :pass} <- validate_target(payload, target),
         {:ok, :pass} <- validate_queue_tree(queue.id, payload, target) do
      {:ok, :pass}
    else
      _ -> {:error, :invalid_docs_release_plan}
    end
  end

  defp validate_plan(_, _), do: {:error, :invalid_docs_release_plan}

  defp validate_baseline(%{public_release_id: nil}, []), do: {:ok, :pass}

  defp validate_baseline(%{public_release_id: id, community_id: community_id}, public)
       when is_integer(id) and is_list(public) do
    tree =
      Repo.one(
        from(release in DocsRelease,
          join: snapshot in DocsReleaseTreeSnapshot,
          on: snapshot.id == release.tree_snapshot_id,
          where:
            release.id == ^id and release.community_id == ^community_id and
              snapshot.community_id == ^community_id and release.sealed == true,
          select: snapshot.tree_json,
          lock: "FOR SHARE"
        )
      )

    with %{} <- tree, {:ok, nodes} <- TreeCodec.decode(tree), true <- nodes === public do
      {:ok, :pass}
    else
      _ -> {:error, :docs_release_baseline_mismatch}
    end
  end

  defp validate_baseline(_, _), do: {:error, :docs_release_baseline_mismatch}

  defp validate_target(%{"public_tree" => public, "tree_operations" => operations}, target)
       when is_list(public) and is_list(operations) do
    changes =
      Enum.map(operations, fn operation ->
        case operation do
          %{node_id: id, action: :delete, target: nil} ->
            %{node_id: id, change_type: :delete, target: nil}

          %{node_id: id, action: action, target: node}
          when action in [:create, :update] and is_map(node) ->
            %{node_id: id, change_type: :upsert, target: Map.delete(node, :node_id)}

          _ ->
            :invalid
        end
      end)

    with {:ok, result} <- TreeOperations.plan(public, changes),
         true <- result.target === target and result.operations === operations do
      {:ok, :pass}
    else
      _ -> {:error, :invalid_docs_release_plan}
    end
  end

  defp validate_target(_, _), do: {:error, :invalid_docs_release_plan}

  defp validate_queue_tree(
         queue_id,
         %{"public_tree" => public, "tree_operations" => operations},
         target
       ) do
    rows =
      Repo.all(
        from(row in DocsQueueTreeChange,
          where: row.queue_id == ^queue_id,
          order_by: row.node_id,
          lock: "FOR UPDATE"
        )
      )

    with {:ok, changes} <- TreeCodec.decode_changes(rows),
         {:ok, result} <- TreeOperations.plan(public, changes),
         true <- result.target === target and result.operations === operations do
      {:ok, :pass}
    else
      _ -> {:error, :docs_release_tree_mismatch}
    end
  end

  defp normalize_publications(items) do
    Enum.reduce_while(items, {:ok, %{}}, fn item, {:ok, result} ->
      with %{article_id: id, snapshot_id: snapshot, work_revision: revision} <- item,
           {:ok, id} <- Ecto.UUID.cast(id),
           {:ok, snapshot} <- Ecto.UUID.cast(snapshot),
           true <- is_integer(revision) and revision > 0,
           false <- Map.has_key?(result, id) do
        {:cont,
         {:ok,
          Map.put(result, id, %{article_id: id, snapshot_id: snapshot, work_revision: revision})}}
      else
        _ -> {:halt, {:error, :invalid_docs_release_members}}
      end
    end)
  end

  defp normalize_deletions(ids) do
    Enum.reduce_while(ids, {:ok, MapSet.new()}, fn id, {:ok, result} ->
      with {:ok, id} <- Ecto.UUID.cast(id), false <- MapSet.member?(result, id) do
        {:cont, {:ok, MapSet.put(result, id)}}
      else
        _ -> {:halt, {:error, :invalid_docs_release_members}}
      end
    end)
  end

  defp validate_members(community, queue, plan, publications, deletions) do
    rows =
      Repo.all(
        from(m in DocsQueueArticle,
          join: w in ArticleWorkingCopy,
          on: w.id == m.working_copy_id and w.article_id == m.article_id,
          where: m.queue_id == ^queue.id,
          order_by: m.article_id,
          select: %{article_id: m.article_id, working_copy_id: w.id, revision: w.revision},
          lock: "FOR UPDATE"
        )
      )

    planned =
      Enum.map(rows, fn row ->
        %{
          "article_id" => row.article_id,
          "working_copy_id" => row.working_copy_id,
          "revision" => row.revision
        }
      end)

    ids = Map.keys(publications) |> Enum.sort()
    delete_ids = MapSet.to_list(deletions)

    cond do
      planned !== plan.payload["articles"] or Enum.map(rows, & &1.article_id) != ids ->
        {:error, :docs_release_plan_members_mismatch}

      not MapSet.disjoint?(MapSet.new(ids), deletions) ->
        {:error, :invalid_docs_release_members}

      deletions != deleted_pages(plan) ->
        {:error, :docs_release_deletions_mismatch}

      true ->
        validate_public_heads(community, rows, publications, delete_ids)
    end
  end

  defp deleted_pages(plan) do
    before =
      plan.payload["public_tree"] |> Enum.filter(&(&1.type == :page)) |> MapSet.new(& &1.doc_id)

    after_ids = plan.target |> Enum.filter(&(&1.type == :page)) |> MapSet.new(& &1.doc_id)
    MapSet.difference(before, after_ids)
  end

  defp validate_public_heads(community, rows, publications, delete_ids) do
    ids = Map.keys(publications) ++ delete_ids

    bindings =
      Repo.all(
        from(b in ArticleBinding,
          where: b.community_id == ^community.id and b.article_id in ^ids and b.thread == :doc,
          select: b.article_id
        )
      )
      |> MapSet.new()

    heads =
      Repo.all(
        from(p in ArticlePublic,
          where: p.article_id in ^ids,
          order_by: p.article_id,
          lock: "FOR UPDATE"
        )
      )
      |> Map.new(&{&1.article_id, &1})

    snapshot_ids = Enum.map(publications, fn {_id, item} -> item.snapshot_id end)

    snapshots =
      Repo.all(
        from(s in ArticleSnapshot,
          where: s.id in ^snapshot_ids,
          order_by: s.id,
          lock: "FOR SHARE"
        )
      )
      |> Map.new(&{&1.id, &1})

    valid? =
      MapSet.size(bindings) == length(ids) and
        Enum.all?(delete_ids, &is_nil(heads[&1])) and
        Enum.all?(rows, fn row ->
          item = publications[row.article_id]
          snapshot = snapshots[item.snapshot_id]
          head = heads[row.article_id]

          match?(%ArticleSnapshot{}, snapshot) and match?(%ArticlePublic{}, head) and
            item.work_revision == row.revision and snapshot.article_id == row.article_id and
            snapshot.source_working_copy_id == row.working_copy_id and
            snapshot.source_revision == row.revision and
            head.snapshot_id == snapshot.id
        end)

    if valid?, do: {:ok, :pass}, else: {:error, :docs_release_public_mismatch}
  end

  defp insert_members(release_id, publications, deletions) do
    published =
      Enum.map(publications, fn {_id, item} ->
        %{
          release_id: release_id,
          article_id: item.article_id,
          action: :publish,
          snapshot_id: item.snapshot_id
        }
      end)

    deleted =
      Enum.map(
        deletions,
        &%{release_id: release_id, article_id: &1, action: :delete, snapshot_id: nil}
      )

    Enum.reduce_while(published ++ deleted, {:ok, :pass}, fn attrs, _ ->
      case %DocsReleaseArticle{} |> DocsReleaseArticle.changeset(attrs) |> Repo.insert() do
        {:ok, _} -> {:cont, {:ok, :pass}}
        {:error, _reason} = error -> {:halt, error}
      end
    end)
  end
end
