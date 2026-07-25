defmodule GroupherServer.CMS.DocTree.Publish.Restore do
  @moduledoc """
  Restores staged tree-delete items back into the draft tree.

      staged delete event
          |
          v
      inverse_payload["node"] + pages
          |
          +--> doc_tree_nodes(stage=draft)
          +--> retained Doc Article aggregate
          |
          v
      mark delete event discarded
          |
          v
      decrement staged_event_count + append CMS Audit

  Only delete-style tree events are valid restore targets. Normal publish still
  handles create, update, and move events through `PublicProjection`.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.DocTree.Publish.Result
  alias CMS.DocTree.Revision

  alias CMS.Model.{
    Community,
    DocTreeEvent,
    DocTreeNode,
    DocsSiteState
  }

  alias Helper.ORM

  require CMS.Const

  @doc_tree_json_key_type CMS.Const.doc_tree_json_key(:type)
  @doc_tree_json_key_doc_id CMS.Const.doc_tree_json_key(:doc_id)
  @tree_node_type_tab CMS.Const.tree_node_type(:tab)
  @tree_node_type_group CMS.Const.tree_node_type(:group)
  @tree_node_type_page CMS.Const.tree_node_type(:page)
  @tree_node_type_link CMS.Const.tree_node_type(:link)
  @tree_node_type_pin CMS.Const.tree_node_type(:pin)
  @tree_node_type_group_key to_string(@tree_node_type_group)
  @tree_node_type_page_key to_string(@tree_node_type_page)
  @tree_node_type_link_key to_string(@tree_node_type_link)
  @tree_node_type_pin_key to_string(@tree_node_type_pin)
  @tree_node_type_tab_key to_string(@tree_node_type_tab)

  @event_node_types %{
    @tree_node_type_tab_key => @tree_node_type_tab,
    @tree_node_type_group_key => @tree_node_type_group,
    @tree_node_type_page_key => @tree_node_type_page,
    @tree_node_type_link_key => @tree_node_type_link,
    @tree_node_type_pin_key => @tree_node_type_pin
  }

  @doc """
  Restores selected staged delete events before publish.

  This legacy publish-checklist path only restores inverse Tree events. Current
  product Trash actions are restored through `DocTree.Trash`.
  """
  def restore_tree_events(%Community{} = community, branch, events, %User{} = user) do
    with :ok <- ensure_delete_restore_events(events),
         {:ok, restore_entries} <- restore_tree_delete_events(community, branch, events),
         {:ok, _audit} <- create_restore_audit(community, branch, user, restore_entries),
         {:ok, _state} <- mark_tree_restore_revision(community, branch, length(restore_entries)) do
      restored_events = Enum.map(restore_entries, & &1.event)

      {:ok, restored_events}
    end
  end

  defp ensure_delete_restore_events(events) do
    events
    |> Enum.reduce_while(:ok, fn event, :ok ->
      if delete_restore_event?(event) do
        {:cont, :ok}
      else
        {:halt, {:error, {:custom, "Only deleted tree publish items can be restored."}}}
      end
    end)
  end

  defp delete_restore_event?(%DocTreeEvent{event_type: type}),
    do: type in [CMS.Const.tree_event(:node_delete), CMS.Const.tree_event(:pin_remove)]

  defp restore_tree_delete_events(%Community{} = community, branch, events) do
    Result.map_while_ok(events, &restore_tree_delete_event(community, branch, &1))
  end

  defp restore_tree_delete_event(%Community{} = community, branch, %DocTreeEvent{} = event) do
    with {:ok, nodes} <- restore_nodes_from_delete_event(event),
         {:ok, _draft_nodes} <- restore_draft_nodes(community, branch, nodes),
         :ok <- mark_restored_delete_event_discarded(event) do
      {:ok, %{event: event, nodes: nodes}}
    end
  end

  defp restore_nodes_from_delete_event(%DocTreeEvent{
         inverse_payload: %{"node" => node} = inverse
       })
       when is_map(node) do
    pages =
      inverse
      |> Map.get("pages", [])
      |> Enum.filter(&is_map/1)

    {:ok, [node | pages]}
  end

  defp restore_nodes_from_delete_event(_event),
    do: {:error, {:custom, "Deleted tree item can not be restored."}}

  defp restore_draft_nodes(%Community{} = community, branch, nodes) do
    Result.map_while_ok(nodes, &restore_draft_node(community, branch, &1))
  end

  defp restore_draft_node(%Community{} = community, branch, node) do
    with {:ok, attrs} <- draft_attrs_from_event_node(community, branch, node),
         nil <- draft_node_by_node_id(community, branch, attrs.node_id),
         {:ok, restored_node} <- ORM.create(DocTreeNode, attrs) do
      {:ok, restored_node}
    else
      %DocTreeNode{} -> {:error, {:custom, "Deleted tree item has already been restored."}}
      error -> error
    end
  end

  defp draft_attrs_from_event_node(%Community{} = community, branch, node) do
    with {:ok, type} <- node_type_atom(node[@doc_tree_json_key_type]) do
      {:ok,
       %{
         community_id: community.id,
         branch_id: branch.id,
         node_id: node["id"],
         stage: CMS.Const.stage(:draft),
         type: type,
         parent_node_id: node["parentNodeId"],
         doc_id: node[@doc_tree_json_key_doc_id],
         title: node["title"],
         index: node["index"] || 0,
         href: node["href"],
         marker: node["marker"],
         badge: node["badge"],
         hidden: Map.get(node, "hidden", false)
       }}
    end
  end

  defp draft_node_by_node_id(%Community{} = community, branch, node_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:draft))
    |> where([n], n.node_id == ^to_string(node_id))
    |> Repo.one()
  end

  defp mark_restored_delete_event_discarded(%DocTreeEvent{} = event) do
    case ORM.update(event, %{status: CMS.Const.tree_event_status(:discarded)}) do
      {:ok, _event} -> :ok
      error -> error
    end
  end

  defp create_restore_audit(%Community{} = community, branch, %User{} = user, restore_entries) do
    nodes = Enum.flat_map(restore_entries, & &1.nodes)

    CMS.Audit.record("doc_tree.restored", %{
      community_id: community.id,
      actor: user,
      resource_type: "doc_tree_event",
      resource_ref: restore_entries |> List.first() |> then(& &1.event.id) |> to_string(),
      resource_snapshot: %{
        branch_id: branch.id,
        restored_event_ids: Enum.map(restore_entries, & &1.event.id),
        restored_node_ids: restored_node_ids(nodes),
        items:
          Enum.flat_map(restore_entries, fn %{event: event, nodes: nodes} ->
            Enum.map(nodes, &audit_item(event, &1))
          end)
      },
      source: "api",
      metadata: %{legacy_publish_restore: true}
    })
  end

  defp restored_node_ids(nodes) do
    nodes
    |> Enum.map(& &1["id"])
    |> Enum.reject(&is_nil/1)
    |> Enum.map(&to_string/1)
  end

  defp audit_item(%DocTreeEvent{} = event, node) do
    %{
      "eventId" => event.id,
      "nodeId" => node["id"],
      "type" => node[@doc_tree_json_key_type],
      "parentNodeId" => node["parentNodeId"],
      "title" => node["title"],
      "docId" => node[@doc_tree_json_key_doc_id]
    }
  end

  defp mark_tree_restore_revision(%Community{} = community, branch, restore_count) do
    with {:ok, state} <-
           ORM.find_by(DocsSiteState, community_id: community.id, branch_id: branch.id) do
      Revision.apply_tree_restore(community, state, restore_count)
    end
  end

  defp node_type_atom(type) do
    case Map.fetch(@event_node_types, type) do
      {:ok, atom} -> {:ok, atom}
      :error -> {:error, {:custom, "Unsupported docs tree node type: #{type}"}}
    end
  end
end
