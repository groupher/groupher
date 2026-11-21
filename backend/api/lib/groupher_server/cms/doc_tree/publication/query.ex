defmodule GroupherServer.CMS.DocTree.Publication.Query do
  @moduledoc """
  Owns read-only, version-bound Docs publication reads.

      authenticated query -> repeatable-read snapshot -> site Gate + batched Doc scope -> projection

  Reads never initialize Queue or copies, never cache authorized content, and
  reject an old client version before returning navigation or a page.
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Gate.Access.{Check, Load}
  alias CMS.Gate.Scope.DocsContent
  alias CMS.DocTree.Publish.{Approval, ContentState, Queue, TreeCodec}

  alias CMS.Model.{
    Article,
    ArticlePublic,
    ArticleSnapshot,
    ArticleWorkingCopy,
    DocsQueueArticle,
    DocsQueueTreeChange,
    DocsPublishApproval,
    DocsPublishApprovalArticle,
    DocsRelease,
    DocsReleaseArticle,
    DocsReleaseTreeSnapshot
  }

  alias CMS.DocTree.Publication.Presentation

  @doc "Reads policy for a config-only actor without granting content access."
  def policy(site, actor) do
    snapshot(site, actor, :docs_queue_configure, fn _ ->
      with {:ok, queue} <- Queue.read(site) do
        {:ok,
         Map.take(queue, [:approval_required, :allow_self_approval, :approval_policy_revision])}
      end
    end)
  end

  @doc "Reads one complete preview navigation and an optional page under fixed versions."
  def preview(site, actor, opts) do
    snapshot(site, actor, :docs_queue_preview, fn context ->
      with {:ok, queue} <- Queue.read(site),
           {:ok, :pass} <- versions_match(queue, opts[:versions]),
           {:ok, plan, copies} <- plan(site, queue),
           allowed <- allowed_ids(actor, context, :preview),
           nodes <- filter_nodes(plan.target, allowed),
           {:ok, page} <- page(site, opts[:article_id], nodes, copies) do
        {:ok,
         %{
           versions: versions(queue),
           nodes: nodes,
           page: page,
           presentation: Presentation.read(site, nodes, copies),
           plan_format_version: plan.format_version
         }}
      end
    end)
  end

  @doc "Reads release summaries with stable descending ID pagination."
  def releases(site, actor, opts) do
    snapshot(site, actor, :docs_history_read, fn _ ->
      limit = min(max(opts[:limit] || 20, 1), 50)

      query =
        from(r in DocsRelease,
          where: r.community_id == ^site.id and r.sealed,
          order_by: [desc: r.id],
          limit: ^(limit + 1)
        )

      query = if opts[:before_id], do: where(query, [r], r.id < ^opts[:before_id]), else: query
      rows = Repo.all(query)

      items =
        Enum.take(rows, limit)
        |> Enum.map(
          &Map.take(&1, [:id, :queue_revision, :approval_id, :published_by_id, :published_at])
        )

      {:ok, %{items: items, next_id: if(length(rows) > limit, do: List.last(items).id)}}
    end)
  end

  @doc "Reads a release tree and its effective historical Snapshot for one visible Doc."
  def release(site, actor, id, article_id) do
    snapshot(site, actor, :docs_history_read, fn context ->
      with %DocsRelease{community_id: owner, sealed: true} = release <- Repo.get(DocsRelease, id),
           true <- owner == site.id,
           %DocsReleaseTreeSnapshot{community_id: ^owner} = tree <-
             Repo.get(DocsReleaseTreeSnapshot, release.tree_snapshot_id),
           {:ok, nodes} <- TreeCodec.decode(tree.tree_json),
           allowed <- allowed_ids(actor, context, :history),
           visible <- filter_nodes(nodes, allowed),
           {:ok, page} <- historical_page(site, id, article_id, visible) do
        {:ok,
         %{
           id: release.id,
           nodes: visible,
           page: page,
           published_at: release.published_at,
           published_by_id: release.published_by_id
         }}
      else
        _ -> {:error, :docs_publication_unavailable}
      end
    end)
  end

  @doc "Reads immutable Snapshots for one visible site-owned Doc, including after workspace purge."
  def snapshots(site, actor, article_id, opts) do
    snapshot(site, actor, :docs_history_read, fn context ->
      if article_id in allowed_ids(actor, context, :history) do
        query =
          from(s in ArticleSnapshot,
            where: s.article_id == ^article_id,
            order_by: [desc: s.captured_at, desc: s.id],
            limit: 21
          )

        cursor = opts[:cursor]

        query =
          case cursor do
            %{"captured_at" => at, "id" => id} when is_binary(at) and is_binary(id) ->
              case {DateTime.from_iso8601(at), Ecto.UUID.cast(id)} do
                {{:ok, at, _}, {:ok, id}} ->
                  where(query, [s], s.captured_at < ^at or (s.captured_at == ^at and s.id < ^id))

                _ ->
                  Repo.rollback(:docs_publication_unavailable)
              end

            nil ->
              query

            _ ->
              Repo.rollback(:docs_publication_unavailable)
          end

        rows = Repo.all(query)

        items =
          Enum.take(rows, 20)
          |> Enum.map(
            &Map.take(&1, [:id, :title, :captured_at, :captured_by_id, :source_revision])
          )

        selected = opts[:snapshot_id]

        with {:ok, page} <- snapshot_page(article_id, selected) do
          {:ok,
           %{
             items: items,
             page: page,
             next_cursor:
               if(length(rows) > 20, do: Map.take(List.last(items), [:captured_at, :id]))
           }}
        end
      else
        {:error, :docs_publication_unavailable}
      end
    end)
  end

  @doc "Compares current queued content with public content or the last sealed approval."
  def diff(site, actor, opts) do
    snapshot(site, actor, :docs_queue_preview, fn context ->
      with {:ok, queue} <- Queue.read(site),
           {:ok, :pass} <- versions_match(queue, opts[:versions]),
           {:ok, plan, copies} <- plan(site, queue),
           {:ok, baseline, before_nodes, before_members} <- baseline(site, queue, opts[:baseline]),
           allowed <- allowed_ids(actor, context, :comparison),
           after_members <-
             Map.merge(public_members(site), copies)
             |> Map.take(Enum.map(plan.target, & &1.doc_id)),
           ids <- Enum.sort(Enum.uniq(Map.keys(before_members) ++ Map.keys(after_members))),
           ids <- Enum.filter(ids, &(&1 in allowed)),
           article_id <- opts[:article_id],
           true <- is_nil(article_id) or article_id in ids,
           {:ok, before_content} <- baseline_content(baseline, before_members[article_id]),
           {:ok, after_content} <- preview_content(after_members[article_id]) do
        {:ok,
         %{
           versions: versions(queue),
           baseline: baseline,
           members:
             Enum.map(ids, fn id ->
               %{
                 article_id: id,
                 before_title: title(before_members[id]),
                 after_title: title(after_members[id]),
                 before_id: owner_id(before_members[id]),
                 after_id: owner_id(after_members[id])
               }
             end),
           before_nodes: filter_nodes(before_nodes, allowed),
           after_nodes: filter_nodes(plan.target, allowed),
           before_content: before_content,
           after_content: after_content
         }}
      else
        false -> {:error, :docs_publication_unavailable}
        {:error, _} = error -> error
      end
    end)
  end

  @doc "Runs an authorized read in a read-only repeatable-read transaction."
  def snapshot(site, actor, action, fun) do
    if Repo.in_transaction?() do
      {:error, :docs_snapshot_requires_new_transaction}
    else
      Repo.transact(fn ->
        Repo.query!("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")

        with {:ok, _} <- Check.community_snapshot(actor, action, site),
             {:ok, context} <- Load.community_snapshot(actor, site) do
          fun.(context)
        end
      end)
    end
  end

  defp allowed_ids(actor, context, mode) do
    Repo.all(from(a in DocsContent.query(actor, context, mode), select: a.id))
  end

  defp plan(site, %{id: nil} = queue) do
    with {:ok, plan} <- Approval.build_plan(site, queue, [], [], :snapshot) do
      {:ok, plan, %{}}
    end
  end

  defp plan(site, queue) do
    rows =
      Repo.all(
        from(m in DocsQueueArticle,
          join: w in ArticleWorkingCopy,
          on: w.id == m.working_copy_id,
          join: a in Article,
          on: a.id == m.article_id and w.article_id == a.id,
          where: m.queue_id == ^queue.id,
          order_by: a.id,
          select: %{article: a, copy: w}
        )
      )

    changes =
      Repo.all(
        from(c in DocsQueueTreeChange, where: c.queue_id == ^queue.id, order_by: c.node_id)
      )

    with {:ok, plan} <- Approval.build_plan(site, queue, rows, changes, :snapshot) do
      {:ok, plan, Map.new(rows, &{&1.article.id, &1.copy})}
    end
  end

  defp versions(queue) do
    %{
      public_release_id: queue.public_release_id,
      queue_revision: queue.queue_revision,
      public_presentation_revision: queue.public_presentation_revision,
      approval_policy_revision: queue.approval_policy_revision,
      approval_id: queue.latest_approval_id,
      planner_version: 1
    }
  end

  defp versions_match(_queue, nil), do: {:ok, :pass}

  defp versions_match(queue, versions) do
    if Jason.decode!(Jason.encode!(versions(queue))) === versions do
      {:ok, :pass}
    else
      {:error, :docs_preview_changed}
    end
  end

  defp filter_nodes(nodes, allowed) do
    Enum.filter(nodes, &(is_nil(&1.doc_id) or &1.doc_id in allowed))
  end

  defp page(_site, nil, _nodes, _copies), do: {:ok, nil}

  defp page(_site, id, nodes, copies) do
    if Enum.any?(nodes, &(&1.doc_id == id)) do
      case copies[id] do
        nil ->
          case Repo.get(ArticlePublic, id) do
            nil -> {:error, :docs_publication_unavailable}
            public -> public_content(id, public.snapshot_id)
          end

        copy ->
          content(copy)
      end
    else
      {:error, :docs_publication_unavailable}
    end
  end

  defp historical_page(_site, _release, nil, _nodes), do: {:ok, nil}

  defp historical_page(site, release_id, id, nodes) do
    if Enum.any?(nodes, &(&1.doc_id == id)) do
      member =
        Repo.one(
          from(m in DocsReleaseArticle,
            join: r in DocsRelease,
            on: r.id == m.release_id,
            where:
              r.community_id == ^site.id and r.sealed and r.id <= ^release_id and
                m.article_id == ^id,
            order_by: [desc: r.id],
            limit: 1
          )
        )

      case member do
        %{action: :publish, snapshot_id: snapshot} -> snapshot_page(id, snapshot)
        _ -> {:error, :docs_publication_unavailable}
      end
    else
      {:error, :docs_publication_unavailable}
    end
  end

  defp snapshot_page(_id, nil), do: {:ok, nil}

  defp snapshot_page(id, snapshot_id) do
    with {:ok, snapshot_id} <- Ecto.UUID.cast(snapshot_id),
         %ArticleSnapshot{article_id: ^id} = row <- Repo.get(ArticleSnapshot, snapshot_id) do
      content(row)
    else
      _ -> {:error, :docs_publication_unavailable}
    end
  end

  defp baseline_content(%{type: :public}, owner), do: preview_content(owner)
  defp baseline_content(_, owner), do: content(owner)

  defp preview_content(%ArticleSnapshot{} = owner) do
    public_content(owner.article_id, owner.id)
  end

  defp preview_content(owner), do: content(owner)

  defp public_content(article_id, snapshot_id) do
    with %CMS.Model.ArticlePublicBody{snapshot_id: ^snapshot_id} = body <-
           Repo.get(CMS.Model.ArticlePublicBody, article_id),
         {:ok, page} <- snapshot_page(article_id, snapshot_id) do
      {:ok, Map.put(page, :body, CMS.Model.ArticleBodyDocument.document(body))}
    else
      _ -> {:error, :docs_publication_unavailable}
    end
  end

  defp content(nil), do: {:ok, nil}

  defp content(owner) do
    with {:ok, data} <- ContentState.load(owner) do
      {:ok, Map.merge(data, %{article_id: owner.article_id, id: owner.id})}
    end
  end

  defp title(nil), do: nil
  defp title(row), do: row.title
  defp owner_id(nil), do: nil
  defp owner_id(row), do: row.id

  defp baseline(site, queue, :approval)
       when queue.approval_required and not is_nil(queue.latest_approval_id) do
    case Repo.get(DocsPublishApproval, queue.latest_approval_id) do
      %DocsPublishApproval{community_id: owner, sealed: true} = approval when owner == site.id ->
        with {:ok, public} <-
               TreeCodec.decode(%{"version" => 1, "nodes" => approval.tree_plan["public_tree"]}),
             {:ok, nodes} <- approved_tree(public, approval.tree_plan["tree_operations"]) do
          members =
            Map.merge(
              release_members(site, approval.base_release_id),
              approval_members(approval.id)
            )
            |> Map.take(Enum.map(nodes, & &1.doc_id))

          {:ok, %{type: :approval, id: approval.id}, nodes, members}
        end

      _ ->
        {:error, :docs_publication_unavailable}
    end
  end

  defp baseline(site, queue, mode) when mode in [:approval, :public, nil] do
    nodes =
      Repo.all(
        from(n in CMS.Model.DocsTreeNode,
          where: n.community_id == ^site.id and n.stage == :public
        )
      )
      |> Enum.map(
        &Map.take(&1, [
          :node_id,
          :type,
          :parent_node_id,
          :index,
          :title,
          :href,
          :doc_id,
          :marker,
          :badge,
          :hidden
        ])
      )

    {:ok, %{type: :public, id: queue.public_release_id}, nodes, public_members(site)}
  end

  defp baseline(_, _, _), do: {:error, :docs_publication_unavailable}

  defp approval_members(id) do
    Repo.all(
      from(m in DocsPublishApprovalArticle,
        join: s in ArticleSnapshot,
        on: s.id == m.snapshot_id,
        where: m.approval_id == ^id,
        select: s
      )
    )
    |> Map.new(&{&1.article_id, &1})
  end

  defp public_members(site) do
    Repo.all(
      from(p in ArticlePublic,
        join: b in CMS.Model.ArticleBinding,
        on: b.article_id == p.article_id,
        join: s in ArticleSnapshot,
        on: s.id == p.snapshot_id,
        where: b.community_id == ^site.id and b.thread == :doc,
        select: s
      )
    )
    |> Map.new(&{&1.article_id, &1})
  end

  defp release_members(_site, nil), do: %{}

  defp release_members(site, release_id) do
    latest =
      Repo.all(
        from(m in DocsReleaseArticle,
          join: r in DocsRelease,
          on: r.id == m.release_id,
          where: r.community_id == ^site.id and r.sealed and r.id <= ^release_id,
          distinct: m.article_id,
          order_by: [asc: m.article_id, desc: r.id],
          select: m
        )
      )

    ids = for %{action: :publish, snapshot_id: id} <- latest, do: id
    Repo.all(from(s in ArticleSnapshot, where: s.id in ^ids)) |> Map.new(&{&1.article_id, &1})
  end

  defp approved_tree(public, operations) do
    encoded = CMS.DocTree.Publish.Plan.storage(public) |> Map.new(&{&1["node_id"], &1})

    target =
      Enum.reduce(operations, encoded, fn op, acc ->
        case op["action"] do
          "delete" -> Map.delete(acc, op["node_id"])
          action when action in ["create", "update"] -> Map.put(acc, op["node_id"], op["target"])
        end
      end)

    TreeCodec.decode(%{"version" => 1, "nodes" => Map.values(target)})
  end
end
