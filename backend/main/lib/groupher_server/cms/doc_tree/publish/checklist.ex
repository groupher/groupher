defmodule GroupherServer.CMS.DocTree.Publish.Checklist do
  @moduledoc """
  Builds the publish checklist shown by the docs ActionSnackbar.

      docs(stage=draft)              doc_tree_events(owner=tree)
             |                                |
             v                                v
      doc:<doc_id> items              tree:<event_id> items
             |                                |
             +--------------+-----------------+
                            v
                    %{doc_changes, tree_changes}

  Checklist item ids are UI-facing and intentionally opaque to the client. This
  module also hides tree create events that belong to doc publishing, so page
  creation and doc content publish stay one checklist item.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.DocTree.Events

  alias CMS.Model.{
    ArticleSnapshot,
    Community,
    Doc,
    DocTreeEvent,
    DocTreeNode
  }

  require CMS.Const

  @tree_node_type_tab CMS.Const.tree_node_type(:tab)
  @tree_node_type_group CMS.Const.tree_node_type(:group)
  @tree_node_type_page CMS.Const.tree_node_type(:page)

  def build(%Community{} = community, branch) do
    doc_changes = doc_change_items(community, branch)
    tree_changes = tree_change_items(community, branch)

    %{
      total_count: length(doc_changes) + length(tree_changes),
      doc_changes: doc_changes,
      tree_changes: tree_changes
    }
  end

  def doc_shell_tree_checklist_item_ids(%Community{} = community, branch) do
    events =
      Events.staged_events(community,
        branch_id: branch.id,
        owner: CMS.Const.tree_event_owner(:tree)
      )

    doc_bound_event_ids = doc_bound_tree_event_ids(community, branch, events)

    events
    |> Enum.filter(fn event ->
      not is_nil(shell_create_event_id(event)) and MapSet.member?(doc_bound_event_ids, event.id)
    end)
    |> Enum.map(&"tree:#{&1.id}")
  end

  def tree_event_action(%DocTreeEvent{event_type: type})
      when type in [CMS.Const.tree_event(:node_create), CMS.Const.tree_event(:pin_add)],
      do: "created"

  def tree_event_action(%DocTreeEvent{event_type: type})
      when type in [CMS.Const.tree_event(:node_delete), CMS.Const.tree_event(:pin_remove)],
      do: "deleted"

  def tree_event_action(%DocTreeEvent{event_type: type})
      when type in [CMS.Const.tree_event(:node_move), CMS.Const.tree_event(:pin_reorder)],
      do: "moved"

  def tree_event_action(%DocTreeEvent{event_type: type})
      when type in [
             CMS.Const.tree_event(:group_rename),
             CMS.Const.tree_event(:node_rename)
           ],
      do: "renamed"

  def tree_event_action(%DocTreeEvent{}), do: "modified"

  def tree_event_label(%DocTreeEvent{
        event_type: type,
        payload: %{"node" => node}
      })
      when type in [CMS.Const.tree_event(:node_create), CMS.Const.tree_event(:pin_add)],
      do: "Added #{node["title"] || node["id"]}"

  def tree_event_label(%DocTreeEvent{
        event_type: type,
        payload: %{"node" => node}
      })
      when type in [CMS.Const.tree_event(:node_delete), CMS.Const.tree_event(:pin_remove)],
      do: "Deleted #{node["title"] || node["id"]}"

  def tree_event_label(%DocTreeEvent{
        event_type: type,
        payload: payload
      })
      when type in [CMS.Const.tree_event(:node_move), CMS.Const.tree_event(:pin_reorder)],
      do: "Moved #{payload["title"] || payload["nodeId"]}"

  def tree_event_label(%DocTreeEvent{event_type: type, payload: payload})
      when type in [
             CMS.Const.tree_event(:group_rename),
             CMS.Const.tree_event(:node_rename)
           ] do
    "Renamed #{payload["before"] || payload["title"]} -> #{payload["after"]}"
  end

  def tree_event_label(%DocTreeEvent{payload: payload}),
    do: "Updated #{payload["title"] || payload["nodeId"]}"

  defp doc_change_items(%Community{} = community, branch) do
    drafts =
      Doc
      |> where([d], d.community_id == ^community.id)
      |> where([d], d.branch_id == ^branch.id)
      |> where([d], d.stage == CMS.Const.stage(:draft))
      |> order_by([d], asc: d.inserted_at, asc: d.id)
      |> Repo.all()

    drafts_by_doc_id = Map.new(drafts, &{&1.doc_id, &1})
    pages = publish_pages_for_drafts(community, branch, Map.keys(drafts_by_doc_id))
    pages_by_doc_id = Map.new(pages, &{&1.doc_id, &1})

    Enum.map(drafts, fn draft ->
      page = Map.get(pages_by_doc_id, draft.doc_id)
      public = public_article_snapshot(community, branch, draft)
      action = if public, do: "modified", else: "created"
      selectable = not is_nil(page)
      disabled_reason = unless selectable, do: "Doc draft is not attached to a tree page."

      %{
        id: "doc:#{draft.doc_id}",
        doc_id: draft.doc_id,
        page_node_id: page && page.node_id,
        title: draft.title,
        action: action,
        selected_by_default: selectable,
        selectable: selectable,
        disabled_reason: disabled_reason
      }
    end)
  end

  defp tree_change_items(%Community{} = community, branch) do
    events =
      Events.staged_events(community,
        branch_id: branch.id,
        owner: CMS.Const.tree_event_owner(:tree)
      )

    doc_bound_event_ids = doc_bound_tree_event_ids(community, branch, events)

    events
    |> Enum.reject(&MapSet.member?(doc_bound_event_ids, &1.id))
    |> Enum.map(fn event ->
      {selectable, disabled_reason} = tree_event_select_state(community, branch, event)

      %{
        id: "tree:#{event.id}",
        event_id: event.id,
        title: tree_event_label(event),
        action: tree_event_action(event),
        selected_by_default: selectable,
        selectable: selectable,
        disabled_reason: disabled_reason
      }
    end)
  end

  defp doc_bound_tree_event_ids(_community, _branch, []), do: MapSet.new()

  defp doc_bound_tree_event_ids(%Community{} = community, branch, events) do
    draft_doc_ids = draft_doc_ids(community, branch)

    page_event_ids =
      events
      |> Enum.filter(fn event ->
        doc_id = page_create_event_doc_id(event)
        not is_nil(doc_id) and MapSet.member?(draft_doc_ids, doc_id)
      end)
      |> MapSet.new(& &1.id)

    group_ids =
      events
      |> Enum.map(&group_create_event_id/1)
      |> Enum.reject(&is_nil/1)

    doc_bound_group_ids =
      draft_group_ids_with_draft_docs(community, branch, group_ids, draft_doc_ids)

    group_event_ids =
      events
      |> Enum.filter(fn event ->
        group_id = group_create_event_id(event)
        not is_nil(group_id) and MapSet.member?(doc_bound_group_ids, group_id)
      end)
      |> MapSet.new(& &1.id)

    tab_ids =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where([n], n.type == @tree_node_type_group)
      |> where([n], n.node_id in ^MapSet.to_list(doc_bound_group_ids))
      |> select([n], n.tab_id)
      |> Repo.all()
      |> MapSet.new()

    tab_event_ids =
      events
      |> Enum.filter(fn event ->
        tab_id = tab_create_event_id(event)
        not is_nil(tab_id) and MapSet.member?(tab_ids, tab_id)
      end)
      |> MapSet.new(& &1.id)

    page_event_ids |> MapSet.union(group_event_ids) |> MapSet.union(tab_event_ids)
  end

  defp page_create_event_doc_id(%DocTreeEvent{
         event_type: CMS.Const.tree_event(:node_create),
         node_type: @tree_node_type_page,
         doc_id: doc_id
       })
       when not is_nil(doc_id),
       do: doc_id

  defp page_create_event_doc_id(_event), do: nil

  defp group_create_event_id(%DocTreeEvent{
         event_type: CMS.Const.tree_event(:node_create),
         node_type: @tree_node_type_group,
         node_id: group_id
       })
       when not is_nil(group_id),
       do: group_id

  defp group_create_event_id(_event), do: nil

  defp tab_create_event_id(%DocTreeEvent{
         event_type: CMS.Const.tree_event(:node_create),
         node_type: @tree_node_type_tab,
         node_id: tab_id
       }),
       do: tab_id

  defp tab_create_event_id(_event), do: nil

  defp shell_create_event_id(event),
    do: group_create_event_id(event) || tab_create_event_id(event)

  defp draft_doc_ids(%Community{} = community, branch) do
    Doc
    |> where([d], d.community_id == ^community.id)
    |> where([d], d.branch_id == ^branch.id)
    |> where([d], d.stage == CMS.Const.stage(:draft))
    |> select([d], d.doc_id)
    |> Repo.all()
    |> MapSet.new()
  end

  defp draft_group_ids_with_draft_docs(_community, _branch, [], _draft_doc_ids), do: MapSet.new()

  defp draft_group_ids_with_draft_docs(%Community{} = community, branch, group_ids, draft_doc_ids) do
    if MapSet.size(draft_doc_ids) == 0 do
      MapSet.new()
    else
      group_ids = Enum.uniq(group_ids)
      draft_doc_ids = MapSet.to_list(draft_doc_ids)

      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where([n], n.type == @tree_node_type_page)
      |> where([n], n.group_id in ^group_ids)
      |> where([n], n.doc_id in ^draft_doc_ids)
      |> select([n], n.group_id)
      |> Repo.all()
      |> MapSet.new()
    end
  end

  defp tree_event_select_state(
         %Community{} = community,
         branch,
         %DocTreeEvent{
           event_type: CMS.Const.tree_event(:node_create),
           node_type: @tree_node_type_page,
           doc_id: doc_id
         }
       ) do
    with %Doc{} <- draft_or_public_doc(community, branch, doc_id) do
      {true, nil}
    else
      _ -> {false, "Publish the page content first."}
    end
  end

  defp tree_event_select_state(_community, _branch, _event), do: {true, nil}

  defp draft_or_public_doc(%Community{} = community, branch, doc_id) do
    Doc
    |> where([doc], doc.community_id == ^community.id)
    |> where([doc], doc.branch_id == ^branch.id)
    |> where([doc], doc.doc_id == ^doc_id)
    |> where([doc], doc.stage in [CMS.Const.stage(:draft), CMS.Const.stage(:public)])
    |> order_by([doc], asc: doc.stage)
    |> limit(1)
    |> Repo.one()
  end

  defp public_article_snapshot(%Community{} = community, branch, %Doc{doc_id: doc_id}) do
    ArticleSnapshot
    |> where([s], s.community_id == ^community.id)
    |> where([s], s.branch_id == ^branch.id)
    |> where([s], s.stage == CMS.Const.stage(:public))
    |> where([s], s.thread == :doc)
    |> where([s], s.doc_id == ^doc_id)
    |> order_by([s], desc: s.snapshot_number, desc: s.id)
    |> limit(1)
    |> Repo.one()
  end

  defp publish_pages_for_drafts(_community, _branch, []), do: []

  defp publish_pages_for_drafts(%Community{} = community, branch, doc_ids) do
    public_pages = pages_by_doc_ids(community, branch, doc_ids, CMS.Const.stage(:public))
    draft_pages = pages_by_doc_ids(community, branch, doc_ids, CMS.Const.stage(:draft))

    public_pages
    |> Enum.concat(draft_pages)
    |> Enum.reduce(%{}, fn page, acc -> Map.put_new(acc, page.doc_id, page) end)
    |> Map.values()
    |> Enum.sort_by(&{&1.index || 0, &1.id})
  end

  defp pages_by_doc_ids(%Community{} = community, branch, doc_ids, stage) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == ^stage)
    |> where([n], n.type == @tree_node_type_page)
    |> where([n], n.doc_id in ^doc_ids)
    |> order_by([n], asc: n.index, asc: n.id)
    |> Repo.all()
  end
end
