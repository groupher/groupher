defmodule GroupherServer.CMS.DocTree.Publish.Restore do
  @moduledoc """
  Restores staged tree-delete items back into the draft tree.

      staged delete event
          |
          v
      inverse_payload["node"] + children
          |
          +--> doc_tree_nodes(stage=draft)
          +--> optional draft doc snapshot from doc_tree_trash_items
          |
          v
      mark delete event discarded
          |
          v
      mark trash rows restored and decrement staged_event_count

  Only delete-style tree events are valid restore targets. Normal publish still
  handles create, update, and move events through `PublicProjection`.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.DocTree.Publish.Result
  alias CMS.DocTree.Revision

  alias CMS.Model.{
    ArticleDocument,
    Community,
    Doc,
    DocTreeEvent,
    DocTreeNode,
    DocTreeRestoreAudit,
    DocTreeTrashItem,
    DocsSiteState
  }

  alias Helper.ORM

  require CMS.Const

  @doc_tree_json_key_type CMS.Const.doc_tree_json_key(:type)
  @doc_tree_json_key_doc_id CMS.Const.doc_tree_json_key(:doc_id)
  @trash_snapshot_key_draft_doc CMS.Const.doc_tree_trash_snapshot_key(:draft_doc)
  @tree_node_type_group CMS.Const.tree_node_type(:group)
  @tree_node_type_page CMS.Const.tree_node_type(:page)
  @tree_node_type_link CMS.Const.tree_node_type(:link)
  @tree_node_type_pin CMS.Const.tree_node_type(:pin)
  @tree_node_type_group_key to_string(@tree_node_type_group)
  @tree_node_type_page_key to_string(@tree_node_type_page)
  @tree_node_type_link_key to_string(@tree_node_type_link)
  @tree_node_type_pin_key to_string(@tree_node_type_pin)

  @event_node_types %{
    @tree_node_type_group_key => @tree_node_type_group,
    @tree_node_type_page_key => @tree_node_type_page,
    @tree_node_type_link_key => @tree_node_type_link,
    @tree_node_type_pin_key => @tree_node_type_pin
  }

  def restore_tree_events(%Community{} = community, events, %User{} = user) do
    with :ok <- ensure_delete_restore_events(events),
         {:ok, restore_entries} <- restore_tree_delete_events(community, events),
         {:ok, _audit} <- create_restore_audit(community, user, restore_entries),
         {:ok, _state} <- mark_tree_restore_revision(community, length(restore_entries)) do
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

  defp restore_tree_delete_events(%Community{} = community, events) do
    Result.map_while_ok(events, &restore_tree_delete_event(community, &1))
  end

  defp restore_tree_delete_event(%Community{} = community, %DocTreeEvent{} = event) do
    with {:ok, nodes} <- restore_nodes_from_delete_event(event),
         {:ok, _draft_nodes} <- restore_draft_nodes(community, nodes),
         :ok <- mark_delete_event_discarded(event),
         :ok <- mark_trash_items_restored(community, nodes) do
      {:ok, %{event: event, nodes: nodes}}
    end
  end

  defp restore_nodes_from_delete_event(%DocTreeEvent{
         inverse_payload: %{"node" => node} = inverse
       })
       when is_map(node) do
    children =
      inverse
      |> Map.get("children", [])
      |> Enum.filter(&is_map/1)

    {:ok, [node | children]}
  end

  defp restore_nodes_from_delete_event(_event),
    do: {:error, {:custom, "Deleted tree item can not be restored."}}

  defp restore_draft_nodes(%Community{} = community, nodes) do
    Result.map_while_ok(nodes, &restore_draft_node(community, &1))
  end

  defp restore_draft_node(%Community{} = community, node) do
    with {:ok, attrs} <- draft_attrs_from_event_node(community, node),
         nil <- draft_node_by_node_id(community, attrs.node_id),
         {:ok, restored_node} <- ORM.create(DocTreeNode, attrs),
         :ok <- restore_doc_draft_from_trash(community, attrs) do
      {:ok, restored_node}
    else
      %DocTreeNode{} -> {:error, {:custom, "Deleted tree item has already been restored."}}
      error -> error
    end
  end

  defp draft_attrs_from_event_node(%Community{} = community, node) do
    with {:ok, type} <- node_type_atom(node[@doc_tree_json_key_type]) do
      {:ok,
       %{
         community_id: community.id,
         node_id: node["id"],
         stage: CMS.Const.stage(:draft),
         type: type,
         group_id: node["groupId"],
         doc_id: node[@doc_tree_json_key_doc_id],
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
  end

  defp draft_node_by_node_id(%Community{} = community, node_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.stage == CMS.Const.stage(:draft))
    |> where([n], n.node_id == ^to_string(node_id))
    |> Repo.one()
  end

  defp restore_doc_draft_from_trash(%Community{} = community, %{
         type: @tree_node_type_page,
         doc_id: doc_id,
         node_id: node_id
       })
       when not is_nil(doc_id) do
    case draft_doc_by_doc_id(community, doc_id) do
      %Doc{} ->
        :ok

      nil ->
        with {:ok, draft_snapshot} <- draft_snapshot_from_trash(community, node_id),
             :ok <- restore_doc_draft_snapshot(community, draft_snapshot) do
          :ok
        else
          :not_found -> :ok
          error -> error
        end
    end
  end

  defp restore_doc_draft_from_trash(_community, _attrs), do: :ok

  defp draft_doc_by_doc_id(%Community{} = community, doc_id) do
    Doc
    |> where([d], d.community_id == ^community.id)
    |> where([d], d.stage == CMS.Const.stage(:draft))
    |> where([d], d.doc_id == ^doc_id)
    |> Repo.one()
  end

  defp draft_snapshot_from_trash(%Community{} = community, node_id) do
    DocTreeTrashItem
    |> where([item], item.community_id == ^community.id)
    |> where([item], item.node_id == ^to_string(node_id))
    |> where([item], is_nil(item.restored_at))
    |> order_by([item], desc: item.deleted_at, desc: item.id)
    |> limit(1)
    |> select([item], item.node_snapshot)
    |> Repo.one()
    |> case do
      %{@trash_snapshot_key_draft_doc => draft_snapshot} when is_map(draft_snapshot) ->
        {:ok, draft_snapshot}

      _ ->
        :not_found
    end
  end

  defp restore_doc_draft_snapshot(%Community{} = community, %{
         "doc" => doc_snapshot,
         "document" => document_snapshot
       })
       when is_map(doc_snapshot) and is_map(document_snapshot) do
    with {:ok, draft} <- ORM.create(Doc, doc_attrs_from_snapshot(community, doc_snapshot)),
         {:ok, _document} <-
           ORM.create(ArticleDocument, document_attrs_from_snapshot(draft, document_snapshot)) do
      :ok
    end
  end

  defp restore_doc_draft_snapshot(_community, _snapshot), do: :ok

  defp doc_attrs_from_snapshot(%Community{} = community, snapshot) do
    %{
      community_id: community.id,
      stage: CMS.Const.stage(:draft),
      doc_id: snapshot["docId"],
      title: snapshot["title"],
      subtitle: snapshot["subtitle"],
      slug: snapshot["slug"],
      digest: snapshot["digest"],
      json: snapshot["json"],
      content_hash: snapshot["contentHash"],
      schema_version: snapshot["schemaVersion"],
      template_key: snapshot["templateKey"],
      author_id: snapshot["authorId"]
    }
  end

  defp document_attrs_from_snapshot(%Doc{} = draft, snapshot) do
    %{
      thread: :doc,
      article_id: draft.id,
      title: snapshot["title"] || draft.title,
      json: snapshot["json"] || draft.json,
      markdown: snapshot["markdown"],
      markdown_toc: snapshot["markdownToc"],
      html: snapshot["html"],
      xml: snapshot["xml"],
      rss: snapshot["rss"],
      plain_text: snapshot["plainText"],
      digest: snapshot["digest"],
      content_hash: snapshot["contentHash"],
      schema_version: snapshot["schemaVersion"]
    }
  end

  defp mark_delete_event_discarded(%DocTreeEvent{} = event) do
    case ORM.update(event, %{status: CMS.Const.tree_event_status(:discarded)}) do
      {:ok, _event} -> :ok
      error -> error
    end
  end

  defp mark_trash_items_restored(%Community{} = community, nodes) do
    node_ids =
      nodes
      |> Enum.map(& &1["id"])
      |> Enum.reject(&is_nil/1)
      |> Enum.map(&to_string/1)

    now = DateTime.utc_now(:second)

    DocTreeTrashItem
    |> where([item], item.community_id == ^community.id)
    |> where([item], item.node_id in ^node_ids)
    |> where([item], is_nil(item.restored_at))
    |> Repo.update_all(set: [restored_at: now, updated_at: now])

    :ok
  end

  defp create_restore_audit(%Community{} = community, %User{} = user, restore_entries) do
    nodes = Enum.flat_map(restore_entries, & &1.nodes)

    ORM.create(DocTreeRestoreAudit, %{
      community_id: community.id,
      actor_id: user.id,
      restored_event_ids: Enum.map(restore_entries, & &1.event.id),
      restored_node_ids: restored_node_ids(nodes),
      restored_at: DateTime.utc_now(:second),
      payload: %{
        "items" =>
          Enum.flat_map(restore_entries, fn %{event: event, nodes: nodes} ->
            Enum.map(nodes, &audit_item(event, &1))
          end)
      }
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
      "title" => node["title"],
      "slug" => node["slug"],
      "docId" => node[@doc_tree_json_key_doc_id],
      "groupId" => node["groupId"]
    }
  end

  defp mark_tree_restore_revision(%Community{} = community, restore_count) do
    with {:ok, state} <- ORM.find_by(DocsSiteState, community_id: community.id) do
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
