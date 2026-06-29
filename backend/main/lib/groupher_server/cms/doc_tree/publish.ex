defmodule GroupherServer.CMS.DocTree.Publish do
  @moduledoc """
  Publish workflows for docs article workspaces and docs tree snapshots.

      Dashboard Editor
      ├─ Article draft changes
      │    article_workspaces(stage=draft)
      │
      └─ Tree draft changes
           doc_tree_events(owner=tree, status=staged)

                 |
                 v
          publish_changes/3
                 |
                 ├─ docs + DocDocument
                 ├─ doc_tree_nodes(stage=public)
                 └─ publish_releases
                      ├─ tree_snapshot_id -> doc_tree_snapshots
                      ├─ publish_release_articles
                      └─ publish_release_tree_events

  Tree and article are still separate domains internally, but the public product
  surface exposes one publish action. The release row is the snapshot anchor that
  lets history and rollback talk about the full public docs site at one moment.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.{ChangeDetection, Events}

  alias CMS.Model.{
    ArticleSnapshot,
    ArticleWorkspace,
    Community,
    DocTreeEvent,
    DocTreeNode,
    DocsSiteState,
    PublishRelease,
    PublishReleaseArticle,
    PublishReleaseTreeEvent
  }

  alias Helper.{ORM, T, Transaction}

  @event_public_fields %{
    "title" => :title,
    "slug" => :slug,
    "href" => :href,
    "marker" => :marker,
    "badge" => :badge,
    "hidden" => :hidden,
    "uiConfig" => :ui_config,
    "ui_config" => :ui_config
  }

  @doc """
  Builds the unified publish checklist consumed by the editor ActionSnackbar.

  The returned ids are opaque UI ids. The frontend should show them as a simple
  checklist and send selected ids back to `publish_changes/4`; dependency
  resolution stays server-side.

  ## Examples

      iex> Publish.plan(community).total_count
      3
  """
  @spec plan(Community.t()) :: map()
  def plan(%Community{} = community) do
    doc_changes = doc_change_items(community)
    tree_changes = tree_change_items(community)

    %{
      total_count: length(doc_changes) + length(tree_changes),
      doc_changes: doc_changes,
      tree_changes: tree_changes
    }
  end

  @doc """
  Publishes selected doc and tree changes as a single release.

  Nil selections mean "publish every selected-by-default item" from the current
  plan. Explicit lists publish only those opaque plan item ids.

  ## Examples

      iex> Publish.publish_changes(community, %{doc_change_ids: ["doc:12"]}, user)
      {:ok, %{done: true, release: %PublishRelease{}}}
  """
  @spec publish_changes(Community.t(), map(), User.t(), keyword()) :: T.domain_res(map())
  def publish_changes(%Community{} = community, args, %User{} = user, opts \\ []) do
    sync_cover? = Keyword.get(opts, :sync_cover, true)

    Transaction.lock_global("doc_tree:#{community.id}", fn ->
      Repo.transaction(fn ->
        current_plan = plan(community)

        with {:ok, doc_ids} <- selected_ids(args, :doc_change_ids, current_plan.doc_changes),
             {:ok, tree_ids} <- selected_ids(args, :tree_change_ids, current_plan.tree_changes),
             {:ok, tree_result} <- prepare_tree_plan_items(community, tree_ids),
             :ok <- preapply_tree_delete_events(community, tree_result.events),
             {:ok, doc_revisions} <- publish_doc_plan_items(community, doc_ids, user, sync_cover?),
             :ok <- apply_tree_events_to_public(community, tree_result.events),
             {:ok, release} <- create_release(community, user, doc_revisions, tree_result),
             next_plan <- plan(community),
             {:ok, _state} <- mark_site_release_published(community, user, next_plan) do
          %{done: true, release: release, plan: next_plan}
        else
          {:error, reason} -> Repo.rollback(reason)
          reason -> Repo.rollback(reason)
        end
      end)
      |> case do
        {:ok, result} -> {:ok, result}
        {:error, reason} -> {:error, reason}
      end
    end)
  end

  @doc """
  Deprecated by the stage model; article draft/public state is content-driven.
  """
  @spec move_doc_to_draft(Community.t(), T.id()) :: T.domain_res(map())
  def move_doc_to_draft(_community, _node_id), do: {:ok, %{done: true}}

  @doc """
  Deprecated by the stage model; tree draft/public state is owned by tree events.
  """
  @spec move_group_to_draft(Community.t(), T.id()) :: T.domain_res(map())
  def move_group_to_draft(_community, _group_id), do: {:ok, %{done: true}}

  @doc """
  Resolves the public-stage node for a stable draft `node_id`.

  Cover mutations use this to translate editor ids into public tree rows.

  ## Examples

      iex> Publish.public_node_for_draft(community, draft.node_id)
      {:ok, %DocTreeNode{stage: :public}}
  """
  @spec public_node_for_draft(Community.t(), T.id()) :: T.domain_res(DocTreeNode.t())
  def public_node_for_draft(%Community{} = community, node_id) do
    ORM.find_by(DocTreeNode,
      community_id: community.id,
      stage: :public,
      node_id: to_string(node_id)
    )
  end

  defp publish_doc_article_workspace_unlocked(
         %Community{} = community,
         workspace_id,
         %User{} = user,
         sync_cover?
       ) do
    with {:ok, draft_page} <- find_draft_page(community, workspace_id),
         {:ok, draft_group} <- find_draft_group(community, draft_page.group_id),
         {:ok, snapshot} <-
           CMS.Articles.publish_article_workspace(community, workspace_id, user),
         {:ok, public_group} <- upsert_public_node(community, draft_group),
         {:ok, public_page} <-
           upsert_public_node(
             community,
             draft_page,
             public_group.node_id,
             snapshot.article_id
           ),
         {:ok, _sync} <- maybe_sync_cover(community, public_group, public_page, sync_cover?) do
      Events.mark_doc_bound_published(community, workspace_id)
      {:ok, snapshot}
    end
  end

  defp selected_ids(args, key, items) do
    case Map.get(args, key) || Map.get(args, Atom.to_string(key)) do
      nil ->
        {:ok, items |> Enum.filter(& &1.selectable) |> Enum.map(& &1.id)}

      ids when is_list(ids) ->
        by_id = Map.new(items, &{&1.id, &1})

        ids
        |> Enum.map(&to_string/1)
        |> Enum.reduce_while({:ok, []}, fn id, {:ok, acc} ->
          case Map.get(by_id, id) do
            nil ->
              {:halt, {:error, {:custom, "Selected publish item no longer exists."}}}

            %{selectable: false, disabled_reason: reason} ->
              {:halt, {:error, {:custom, reason || "Selected publish item is not available."}}}

            _item ->
              {:cont, {:ok, [id | acc]}}
          end
        end)
        |> case do
          {:ok, selected} -> {:ok, Enum.reverse(selected)}
          error -> error
        end
    end
  end

  defp publish_doc_plan_items(%Community{} = community, doc_ids, %User{} = user, sync_cover?) do
    items = Map.new(doc_change_items(community), &{&1.id, &1})

    doc_ids
    |> Enum.reduce_while({:ok, []}, fn id, {:ok, acc} ->
      with %{workspace_id: workspace_id} = item <- Map.get(items, id),
           {:ok, snapshot} <-
             publish_doc_article_workspace_unlocked(
               community,
               workspace_id,
               user,
               sync_cover?
             ) do
        {:cont, {:ok, [%{snapshot: snapshot, plan_item: item} | acc]}}
      else
        nil -> {:halt, {:error, {:custom, "Selected docs publish item no longer exists."}}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, entries} -> {:ok, Enum.reverse(entries)}
      error -> error
    end
  end

  defp prepare_tree_plan_items(%Community{} = community, tree_ids) do
    events = selected_tree_events(community, tree_ids)

    if length(events) != length(tree_ids) do
      {:error, {:custom, "Selected tree publish item no longer exists."}}
    else
      article_snapshots = release_article_snapshots_before_tree_events(community, events)

      {:ok, %{events: events, article_snapshots: article_snapshots}}
    end
  end

  defp preapply_tree_delete_events(%Community{} = community, events) do
    events
    |> Enum.filter(&(&1.event_type == "node.delete"))
    |> apply_tree_events_to_public(community)
  end

  defp apply_tree_events_to_public(events, %Community{} = community),
    do: apply_tree_events_to_public(community, events)

  defp apply_tree_events_to_public(%Community{} = community, events) do
    events
    |> Enum.reduce_while(:ok, fn event, :ok ->
      case apply_tree_event_to_public(community, event) do
        :ok -> {:cont, :ok}
        {:ok, _node} -> {:cont, :ok}
        error -> {:halt, error}
      end
    end)
  end

  defp selected_tree_events(_community, []), do: []

  defp selected_tree_events(%Community{} = community, tree_ids) do
    ids =
      tree_ids
      |> Enum.map(&String.replace_prefix(&1, "tree:", ""))
      |> Enum.map(&String.to_integer/1)

    DocTreeEvent
    |> where([e], e.community_id == ^community.id)
    |> where([e], e.status == :staged)
    |> where([e], e.owner == :tree)
    |> where([e], e.id in ^ids)
    |> order_by([e], asc: e.seq, asc: e.id)
    |> Repo.all()
  end

  defp apply_tree_event_to_public(
         %Community{} = community,
         %DocTreeEvent{event_type: "node.create"} = event
       ) do
    node = event.payload["node"] || %{}

    with {:ok, attrs} <- public_attrs_from_event_node(community, node) do
      upsert_public_node_attrs(community, node["id"], attrs)
    end
  end

  defp apply_tree_event_to_public(
         %Community{} = community,
         %DocTreeEvent{event_type: "node.delete"} = event
       ) do
    node = event.payload["node"] || %{}

    delete_public_node_by_node_id(community, node["id"])
  end

  defp apply_tree_event_to_public(
         %Community{} = community,
         %DocTreeEvent{event_type: "node.move"} = event
       ) do
    payload = event.payload

    update_public_node_by_node_id(community, payload["nodeId"], %{
      group_id: payload["afterGroupId"],
      index: payload["afterIndex"]
    })
  end

  defp apply_tree_event_to_public(%Community{} = community, %DocTreeEvent{} = event) do
    payload = event.payload

    with {:ok, field} <- field_atom(payload["field"]) do
      update_public_node_by_node_id(community, payload["nodeId"], %{field => payload["after"]})
    end
  end

  defp public_attrs_from_event_node(%Community{} = community, %{"type" => "page"} = node) do
    workspace_id = node["workspaceId"]

    with {:ok, draft} <- ORM.find(ArticleWorkspace, workspace_id),
         true <-
           draft.community_id == community.id ||
             {:error, {:custom, "Docs page belongs to another community."}},
         article_id when not is_nil(article_id) <- draft.article_id do
      {:ok,
       %{
         community_id: community.id,
         node_id: node["id"],
         stage: :public,
         type: :page,
         group_id: node["groupId"],
         workspace_id: nil,
         doc_id: article_id,
         title: node["title"],
         slug: node["slug"],
         index: node["index"] || 0,
         href: node["href"],
         marker: node["marker"],
         badge: node["badge"],
         hidden: Map.get(node, "hidden", false),
         ui_config: Map.get(node, "uiConfig", %{})
       }}
    else
      nil -> {:error, {:custom, "Publish docs before publishing tree."}}
      error -> error
    end
  end

  defp public_attrs_from_event_node(%Community{} = community, node) do
    {:ok,
     %{
       community_id: community.id,
       node_id: node["id"],
       stage: :public,
       type: String.to_existing_atom(node["type"]),
       group_id: node["groupId"],
       workspace_id: nil,
       doc_id: nil,
       title: node["title"],
       slug: node["slug"],
       index: node["index"] || 0,
       href: node["href"],
       marker: node["marker"],
       badge: node["badge"],
       hidden: Map.get(node, "hidden", false),
       ui_config: Map.get(node, "uiConfig", %{})
     }}
  end

  defp upsert_public_node_attrs(%Community{} = community, node_id, attrs) do
    case public_node_by_node_id(community, node_id) do
      %DocTreeNode{} = node -> ORM.update(node, attrs)
      nil -> ORM.create(DocTreeNode, attrs)
    end
  end

  defp update_public_node_by_node_id(%Community{} = community, node_id, attrs) do
    case public_node_by_node_id(community, node_id) do
      %DocTreeNode{} = node -> ORM.update(node, attrs)
      nil -> {:ok, :missing}
    end
  end

  defp delete_public_node_by_node_id(%Community{} = community, node_id) do
    case public_node_by_node_id(community, node_id) do
      %DocTreeNode{type: :group} = node ->
        delete_public_group_children(community, node.node_id)

        ORM.delete(node)

      %DocTreeNode{} = node ->
        ORM.delete(node)

      nil ->
        delete_public_group_children(community, node_id)
    end
  end

  defp delete_public_group_children(%Community{} = community, group_id) do
    community
    |> public_group_children(group_id)
    |> Enum.each(&ORM.delete/1)

    :ok
  end

  defp public_node_by_node_id(%Community{} = community, node_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.stage == :public)
    |> where([n], n.node_id == ^to_string(node_id))
    |> Repo.one()
  end

  defp public_group_children(%Community{} = community, group_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.stage == :public)
    |> where([n], n.group_id == ^group_id)
    |> Repo.all()
  end

  defp field_atom(field) do
    case Map.fetch(@event_public_fields, field) do
      {:ok, atom} -> {:ok, atom}
      :error -> {:error, {:custom, "Unsupported docs tree field: #{field}"}}
    end
  end

  defp create_release(
         %Community{} = community,
         %User{} = user,
         doc_entries,
         %{events: tree_events, article_snapshots: article_snapshots}
       ) do
    tree_json = CMS.DocTree.Snapshot.published_json(community)
    event_ids = Enum.map(tree_events, & &1.id)

    with {:ok, tree_snapshot} <-
           Events.publish_snapshot(community, user.id, "publish release",
             tree_json: tree_json,
             event_ids: event_ids
           ),
         {:ok, _state} <- mark_tree_release_published(community, tree_snapshot),
         {:ok, release} <-
           ORM.create(PublishRelease, %{
             community_id: community.id,
             release_number: next_release_number(community),
             tree_snapshot_id: tree_snapshot.id,
             author_id: user.id,
             published_at: DateTime.utc_now(:second)
           }),
         {:ok, _articles} <-
           create_release_articles(release, doc_entries, tree_events, article_snapshots),
         {:ok, _events} <- create_release_tree_events(release, tree_events) do
      {:ok, release}
    end
  end

  defp mark_tree_release_published(%Community{} = community, tree_snapshot) do
    with {:ok, state} <- ORM.find_by(DocsSiteState, community_id: community.id) do
      ORM.update(state, %{
        base_snapshot_id: tree_snapshot.id,
        staged_event_count: Events.staged_tree_event_count(community)
      })
    end
  end

  defp mark_site_release_published(%Community{} = community, %User{} = user, next_plan) do
    with {:ok, state} <- ORM.find_by(DocsSiteState, community_id: community.id) do
      attrs = %{
        last_published_at: DateTime.utc_now(:second),
        last_published_by_id: user.id
      }

      attrs =
        if next_plan.total_count == 0 do
          Map.put(attrs, :published_version, state.site_draft_version)
        else
          attrs
        end

      ORM.update(state, attrs)
    end
  end

  defp create_release_articles(
         %PublishRelease{} = release,
         doc_entries,
         tree_events,
         article_snapshots
       ) do
    doc_rows = Enum.map(doc_entries, &release_article_attrs_from_doc(release, &1))

    tree_rows = release_article_attrs_from_tree_events(release, tree_events, article_snapshots)

    (doc_rows ++ tree_rows)
    |> Enum.reject(&is_nil/1)
    |> merge_release_article_attrs()
    |> Enum.reduce_while({:ok, []}, fn attrs, {:ok, acc} ->
      case ORM.create(PublishReleaseArticle, attrs) do
        {:ok, row} -> {:cont, {:ok, [row | acc]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, rows} -> {:ok, Enum.reverse(rows)}
      error -> error
    end
  end

  defp release_article_attrs_from_doc(%PublishRelease{} = release, %{
         snapshot: %ArticleSnapshot{} = snapshot,
         plan_item: plan_item
       }) do
    node = public_page_by_doc_id(release.community_id, snapshot.article_id)

    %{
      release_id: release.id,
      article_id: snapshot.article_id,
      snapshot_id: snapshot.id,
      node_id: node && node.node_id,
      group_node_id: node && node.group_id,
      index: node && node.index,
      title: snapshot.title,
      actions: [plan_item.action]
    }
  end

  defp release_article_attrs_from_tree_events(
         %PublishRelease{} = release,
         tree_events,
         article_snapshots
       ) do
    snapshot_rows =
      article_snapshots
      |> Map.values()
      |> Enum.map(&Map.put(&1, :release_id, release.id))

    current_rows =
      tree_events
      |> Enum.flat_map(&article_node_ids_from_tree_event/1)
      |> Enum.uniq()
      |> Enum.map(fn node_id ->
        with %DocTreeNode{doc_id: article_id} = node when not is_nil(article_id) <-
               public_page_by_node_id(release.community_id, node_id),
             %ArticleSnapshot{} = snapshot <-
               latest_public_article_snapshot(release.community_id, article_id) do
          %{
            release_id: release.id,
            article_id: article_id,
            snapshot_id: snapshot.id,
            node_id: node.node_id,
            group_node_id: node.group_id,
            index: node.index,
            title: snapshot.title,
            actions: actions_from_tree_events(tree_events, node.node_id)
          }
        else
          _ -> nil
        end
      end)

    snapshot_rows ++ current_rows
  end

  defp release_article_snapshots_before_tree_events(%Community{} = community, tree_events) do
    tree_events
    |> Enum.flat_map(&release_article_snapshots_before_tree_event(community, &1))
    |> Enum.reject(&is_nil/1)
    |> merge_release_article_attrs()
    |> Map.new(&{&1.node_id, Map.delete(&1, :release_id)})
  end

  defp release_article_snapshots_before_tree_event(
         %Community{} = community,
         %DocTreeEvent{
           event_type: "node.delete",
           payload: %{"node" => %{"type" => "group", "id" => id}}
         } = event
       ) do
    community
    |> public_group_children(id)
    |> Enum.filter(&(&1.type == :page))
    |> Enum.map(
      &release_article_attrs_from_public_node(community.id, &1, [tree_event_action(event)])
    )
  end

  defp release_article_snapshots_before_tree_event(
         %Community{} = community,
         %DocTreeEvent{
           event_type: "node.delete",
           payload: %{"node" => %{"type" => "page"}}
         } = event
       ) do
    event
    |> article_node_ids_from_tree_event()
    |> Enum.map(fn node_id ->
      with %DocTreeNode{} = node <- public_page_by_node_id(community.id, node_id) do
        release_article_attrs_from_public_node(community.id, node, [tree_event_action(event)])
      end
    end)
  end

  defp release_article_snapshots_before_tree_event(_community, _event), do: []

  defp release_article_attrs_from_public_node(
         community_id,
         %DocTreeNode{doc_id: article_id} = node,
         actions
       )
       when not is_nil(article_id) do
    with %ArticleSnapshot{} = snapshot <- latest_public_article_snapshot(community_id, article_id) do
      %{
        article_id: article_id,
        snapshot_id: snapshot.id,
        node_id: node.node_id,
        group_node_id: node.group_id,
        index: node.index,
        title: snapshot.title,
        actions: actions
      }
    end
  end

  defp release_article_attrs_from_public_node(_community_id, _node, _actions), do: nil

  defp merge_release_article_attrs(rows) do
    rows
    |> Enum.group_by(& &1.article_id)
    |> Enum.map(fn {_article_id, grouped_rows} ->
      Enum.reduce(grouped_rows, %{}, fn row, acc ->
        Map.merge(acc, row, fn
          :actions, left, right -> Enum.uniq(left ++ right)
          _key, nil, right -> right
          _key, left, nil -> left
          _key, _left, right -> right
        end)
      end)
    end)
  end

  defp create_release_tree_events(%PublishRelease{} = release, tree_events) do
    tree_events
    |> Enum.reduce_while({:ok, []}, fn event, {:ok, acc} ->
      case ORM.create(PublishReleaseTreeEvent, %{
             release_id: release.id,
             doc_tree_event_id: event.id,
             event_type: event.event_type,
             label: tree_event_label(event),
             payload: event.payload,
             inverse_payload: event.inverse_payload
           }) do
        {:ok, row} -> {:cont, {:ok, [row | acc]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, rows} -> {:ok, Enum.reverse(rows)}
      error -> error
    end
  end

  defp public_page_by_doc_id(community_id, article_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community_id)
    |> where([n], n.stage == :public)
    |> where([n], n.type == :page)
    |> where([n], n.doc_id == ^article_id)
    |> Repo.one()
  end

  defp public_page_by_node_id(community_id, node_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community_id)
    |> where([n], n.stage == :public)
    |> where([n], n.type == :page)
    |> where([n], n.node_id == ^node_id)
    |> Repo.one()
  end

  defp latest_public_article_snapshot(community_id, article_id) do
    ArticleSnapshot
    |> where([r], r.community_id == ^community_id)
    |> where([r], r.stage == :public)
    |> where([r], r.article_thread == :doc)
    |> where([r], r.article_id == ^article_id)
    |> order_by([r], desc: r.snapshot_number, desc: r.id)
    |> limit(1)
    |> Repo.one()
  end

  defp article_node_ids_from_tree_event(%DocTreeEvent{
         event_type: "node.create",
         payload: %{"node" => %{"type" => "page", "id" => id}}
       }),
       do: [id]

  defp article_node_ids_from_tree_event(%DocTreeEvent{
         event_type: "node.delete",
         payload: %{"node" => %{"type" => "page", "id" => id}}
       }),
       do: [id]

  defp article_node_ids_from_tree_event(%DocTreeEvent{payload: %{"nodeId" => id}}), do: [id]
  defp article_node_ids_from_tree_event(_event), do: []

  defp actions_from_tree_events(tree_events, node_id) do
    tree_events
    |> Enum.filter(&(node_id in article_node_ids_from_tree_event(&1)))
    |> Enum.map(&tree_event_action/1)
    |> Enum.uniq()
  end

  defp next_release_number(%Community{} = community) do
    PublishRelease
    |> where([r], r.community_id == ^community.id)
    |> select([r], max(r.release_number))
    |> Repo.one()
    |> case do
      nil -> 1
      number -> number + 1
    end
  end

  defp doc_change_items(%Community{} = community) do
    pages = unpublished_draft_pages(community)
    version_ids = Enum.map(pages, & &1.workspace_id)

    versions =
      ArticleWorkspace
      |> where([v], v.community_id == ^community.id)
      |> where([v], v.id in ^version_ids)
      |> Repo.all()
      |> Map.new(&{&1.id, &1})

    Enum.map(pages, fn page ->
      draft = Map.fetch!(versions, page.workspace_id)
      public = public_article_snapshot(community, draft)
      action = if public, do: "modified", else: "created"

      %{
        id: "doc:#{draft.id}",
        workspace_id: draft.id,
        title: draft.title,
        action: action,
        selected_by_default: true,
        selectable: true,
        disabled_reason: nil
      }
    end)
  end

  defp tree_change_items(%Community{} = community) do
    community
    |> Events.staged_events(owner: :tree)
    |> Enum.flat_map(fn event ->
      {selectable, _disabled_reason} = tree_event_select_state(community, event)

      if selectable do
        [
          %{
            id: "tree:#{event.id}",
            event_id: event.id,
            title: tree_event_label(event),
            action: tree_event_action(event),
            selected_by_default: true,
            selectable: true,
            disabled_reason: nil
          }
        ]
      else
        []
      end
    end)
  end

  defp tree_event_select_state(
         %Community{} = community,
         %DocTreeEvent{
           event_type: "node.create",
           payload: %{"node" => %{"type" => "page"} = node}
         }
       ) do
    with {:ok, %ArticleWorkspace{community_id: community_id, article_id: article_id}} <-
           ORM.find(ArticleWorkspace, node["workspaceId"]),
         true <- community_id == community.id,
         true <- not is_nil(article_id) do
      {true, nil}
    else
      _ -> {false, "Publish the page content first."}
    end
  end

  defp tree_event_select_state(_community, _event), do: {true, nil}

  defp public_article_snapshot(_community, %ArticleWorkspace{article_id: nil}), do: nil

  defp public_article_snapshot(%Community{} = community, %ArticleWorkspace{article_id: article_id}) do
    ArticleSnapshot
    |> where([s], s.community_id == ^community.id)
    |> where([s], s.stage == :public)
    |> where([s], s.article_thread == :doc)
    |> where([s], s.article_id == ^article_id)
    |> order_by([s], desc: s.snapshot_number, desc: s.id)
    |> limit(1)
    |> Repo.one()
  end

  defp tree_event_action(%DocTreeEvent{event_type: "node.create"}), do: "created"
  defp tree_event_action(%DocTreeEvent{event_type: "node.delete"}), do: "deleted"
  defp tree_event_action(%DocTreeEvent{event_type: "node.move"}), do: "moved"

  defp tree_event_action(%DocTreeEvent{event_type: type})
       when type in ["group.rename", "node.rename"], do: "renamed"

  defp tree_event_action(%DocTreeEvent{}), do: "modified"

  defp tree_event_label(%DocTreeEvent{event_type: "node.create", payload: %{"node" => node}}),
    do: "Added #{node["title"] || node["id"]}"

  defp tree_event_label(%DocTreeEvent{event_type: "node.delete", payload: %{"node" => node}}),
    do: "Deleted #{node["title"] || node["id"]}"

  defp tree_event_label(%DocTreeEvent{event_type: "node.move", payload: payload}),
    do: "Moved #{payload["title"] || payload["nodeId"]}"

  defp tree_event_label(%DocTreeEvent{event_type: type, payload: payload})
       when type in ["group.rename", "node.rename"] do
    "Renamed #{payload["before"] || payload["title"]} -> #{payload["after"]}"
  end

  defp tree_event_label(%DocTreeEvent{payload: payload}),
    do: "Updated #{payload["title"] || payload["nodeId"]}"

  defp find_draft_page(%Community{} = community, workspace_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.stage == :draft)
    |> where([n], n.type == :page)
    |> where([n], n.workspace_id == ^workspace_id)
    |> Repo.one()
    |> case do
      %DocTreeNode{} = node -> {:ok, node}
      nil -> {:error, {:custom, "docs draft page has not been added to the side tree"}}
    end
  end

  defp find_draft_group(%Community{} = community, group_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.stage == :draft)
    |> where([n], n.type == :group)
    |> where([n], n.node_id == ^to_string(group_id))
    |> Repo.one()
    |> case do
      %DocTreeNode{} = node -> {:ok, node}
      nil -> {:error, {:custom, "docs draft page group does not exist"}}
    end
  end

  defp unpublished_draft_pages(%Community{} = community) do
    pages =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.stage == :draft)
      |> where([n], n.type == :page)
      |> where([n], not is_nil(n.workspace_id))
      |> order_by([n], asc: n.index, asc: n.id)
      |> Repo.all()

    version_ids = Enum.map(pages, & &1.workspace_id)

    versions =
      ArticleWorkspace
      |> where([v], v.community_id == ^community.id)
      |> where([v], v.id in ^version_ids)
      |> Repo.all()
      |> Map.new(&{&1.id, &1})

    public_snapshots =
      versions
      |> Map.values()
      |> Enum.map(& &1.article_id)
      |> Enum.reject(&is_nil/1)
      |> then(fn article_ids ->
        ArticleSnapshot
        |> where([s], s.community_id == ^community.id)
        |> where([s], s.stage == :public)
        |> where([s], s.article_thread == :doc)
        |> where([s], s.article_id in ^article_ids)
        |> order_by([s], desc: s.snapshot_number, desc: s.id)
        |> Repo.all()
        |> Enum.uniq_by(& &1.article_id)
        |> Map.new(&{&1.article_id, &1})
      end)

    Enum.filter(pages, fn page ->
      draft = Map.get(versions, page.workspace_id)
      public = draft && draft.article_id && Map.get(public_snapshots, draft.article_id)

      ChangeDetection.draft_content_changed?(draft, public)
    end)
  end

  defp upsert_public_node(
         %Community{} = community,
         %DocTreeNode{} = draft_node,
         group_id \\ nil,
         doc_id \\ nil,
         public_nodes \\ nil
       ) do
    public_nodes =
      public_nodes ||
        DocTreeNode
        |> where([n], n.community_id == ^community.id)
        |> where([n], n.stage == :public)
        |> where([n], n.node_id == ^draft_node.node_id)
        |> Repo.all()
        |> Map.new(&{&1.node_id, &1})

    attrs = public_attrs(draft_node, group_id, doc_id)

    case Map.get(public_nodes, draft_node.node_id) do
      %DocTreeNode{} = public_node -> ORM.update(public_node, attrs)
      nil -> ORM.create(DocTreeNode, attrs)
    end
  end

  defp public_attrs(%DocTreeNode{} = draft_node, group_id, doc_id) do
    draft_node
    |> Map.take([
      :community_id,
      :node_id,
      :type,
      :title,
      :slug,
      :index,
      :href,
      :marker,
      :badge,
      :hidden,
      :ui_config
    ])
    |> Map.merge(%{stage: :public, group_id: group_id, workspace_id: nil, doc_id: doc_id})
  end

  defp maybe_sync_cover(_community, _published_group, _published_page, false), do: {:ok, :skipped}

  defp maybe_sync_cover(
         %Community{} = community,
         %DocTreeNode{} = group,
         %DocTreeNode{} = page,
         true
       ),
       do: CMS.DocCover.Sync.sync_published_page(community, group, page)
end
