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

  require GroupherServer.CMS.DocTree.Const
  require GroupherServer.CMS.Const

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}

  alias CMS.DocTree.Events

  alias CMS.Model.{
    Article,
    Community,
    DocDraft,
    DocLifecycle,
    DocPublic,
    DocsSiteState,
    DocTreeEvent,
    DocTreeNode
  }

  @tree_node_type_tab CMS.DocTree.Const.tree_node_type(:tab)
  @tree_node_type_group CMS.DocTree.Const.tree_node_type(:group)
  @tree_node_type_page CMS.DocTree.Const.tree_node_type(:page)

  @doc """
  Builds the publish checklist for one docs branch.

  The checklist groups draft doc changes and staged tree changes into
  `%{total_count, doc_changes, tree_changes}`. Tree create events that belong to
  doc publishing are hidden behind their doc change item.

  ## Examples

      Checklist.build(community, branch)
      #=> %{total_count: 2, doc_changes: [%{id: "doc:hash"}], tree_changes: []}

  """
  def build(%Community{} = community, branch) do
    doc_changes = doc_change_items(community, branch)
    tree_changes = tree_change_items(community, branch)

    %{
      revision: tree_revision(community, branch),
      total_count: length(doc_changes) + length(tree_changes),
      doc_changes: doc_changes,
      tree_changes: tree_changes
    }
  end

  defp tree_revision(community, branch) do
    case Repo.get_by(DocsSiteState, community_id: community.id, branch_id: branch.id) do
      %DocsSiteState{site_draft_version: revision} -> revision
      _ -> 0
    end
  end

  def doc_shell_tree_checklist_item_ids(%Community{} = community, branch) do
    events =
      Events.staged_events(community,
        branch_id: branch.id,
        owner: CMS.DocTree.Const.tree_event_owner(:tree)
      )

    doc_bound_event_ids = doc_bound_tree_event_ids(community, branch, events)

    events
    |> Enum.filter(fn event ->
      not is_nil(shell_create_event_id(event)) and MapSet.member?(doc_bound_event_ids, event.id)
    end)
    |> Enum.map(&"tree:#{&1.id}")
  end

  def tree_event_action(%DocTreeEvent{event_type: type})
      when type in [
             CMS.DocTree.Const.tree_event(:node_create),
             CMS.DocTree.Const.tree_event(:pin_add)
           ] do
    "created"
  end

  def tree_event_action(%DocTreeEvent{event_type: type})
      when type in [
             CMS.DocTree.Const.tree_event(:node_delete),
             CMS.DocTree.Const.tree_event(:pin_remove)
           ] do
    "deleted"
  end

  def tree_event_action(%DocTreeEvent{event_type: type})
      when type in [
             CMS.DocTree.Const.tree_event(:node_move),
             CMS.DocTree.Const.tree_event(:pin_reorder)
           ] do
    "moved"
  end

  def tree_event_action(%DocTreeEvent{event_type: type})
      when type in [
             CMS.DocTree.Const.tree_event(:group_rename),
             CMS.DocTree.Const.tree_event(:node_rename)
           ] do
    "renamed"
  end

  def tree_event_action(%DocTreeEvent{}), do: "modified"

  def tree_event_label(%DocTreeEvent{
        event_type: type,
        payload: %{"node" => node}
      })
      when type in [
             CMS.DocTree.Const.tree_event(:node_create),
             CMS.DocTree.Const.tree_event(:pin_add)
           ] do
    "Added #{node["title"] || node["id"]}"
  end

  def tree_event_label(%DocTreeEvent{
        event_type: type,
        payload: %{"node" => node}
      })
      when type in [
             CMS.DocTree.Const.tree_event(:node_delete),
             CMS.DocTree.Const.tree_event(:pin_remove)
           ] do
    "Deleted #{node["title"] || node["id"]}"
  end

  def tree_event_label(%DocTreeEvent{
        event_type: type,
        payload: payload
      })
      when type in [
             CMS.DocTree.Const.tree_event(:node_move),
             CMS.DocTree.Const.tree_event(:pin_reorder)
           ] do
    "Moved #{payload["title"] || payload["nodeId"]}"
  end

  def tree_event_label(%DocTreeEvent{event_type: type, payload: payload})
      when type in [
             CMS.DocTree.Const.tree_event(:group_rename),
             CMS.DocTree.Const.tree_event(:node_rename)
           ] do
    "Renamed #{payload["before"] || payload["title"]} -> #{payload["after"]}"
  end

  def tree_event_label(%DocTreeEvent{payload: payload}) do
    "Updated #{payload["title"] || payload["nodeId"]}"
  end

  defp doc_change_items(%Community{} = community, branch) do
    drafts =
      DocDraft
      |> join(:inner, [draft], article in Article, on: article.id == draft.article_id)
      |> join(:inner, [draft, _article], lifecycle in DocLifecycle,
        on: lifecycle.article_id == draft.article_id and lifecycle.branch_id == draft.branch_id
      )
      |> where([draft, article, _lifecycle], article.community_id == ^community.id)
      |> where([draft, _article, _lifecycle], draft.branch_id == ^branch.id)
      |> order_by([draft, _article, _lifecycle], asc: draft.inserted_at, asc: draft.id)
      |> select([draft, _article, lifecycle], {draft, lifecycle.version})
      |> Repo.all()

    drafts_by_doc_id =
      Map.new(drafts, fn {draft, _lifecycle_version} -> {draft.article_id, draft} end)

    pages = publish_pages_for_drafts(community, branch, Map.keys(drafts_by_doc_id))
    pages_by_doc_id = Map.new(pages, &{&1.doc_id, &1})

    Enum.map(drafts, fn {draft, lifecycle_version} ->
      page = Map.get(pages_by_doc_id, draft.article_id)
      public = public_doc(community, branch, draft.article_id)
      action = if public, do: "modified", else: "created"
      selectable = not is_nil(page)
      disabled_reason = unless selectable, do: "Doc draft is not attached to a tree page."

      %{
        id: "doc:#{draft.article_id}",
        doc_id: draft.article_id,
        page_node_id: page && page.node_id,
        title: draft.title,
        draft_version: draft.version,
        lifecycle_version: lifecycle_version,
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
        owner: CMS.DocTree.Const.tree_event_owner(:tree)
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

    ancestor_node_ids = draft_ancestor_ids_with_draft_docs(community, branch, draft_doc_ids)

    shell_event_ids =
      events
      |> Enum.filter(fn event ->
        node_id = shell_create_event_id(event)
        not is_nil(node_id) and MapSet.member?(ancestor_node_ids, node_id)
      end)
      |> MapSet.new(& &1.id)

    MapSet.union(page_event_ids, shell_event_ids)
  end

  defp draft_ancestor_ids_with_draft_docs(
         %Community{} = community,
         branch,
         draft_doc_ids
       ) do
    nodes =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> Repo.all()

    parents = Map.new(nodes, &{&1.node_id, &1.parent_node_id})

    nodes
    |> Enum.filter(fn node ->
      node.type == @tree_node_type_page and MapSet.member?(draft_doc_ids, node.doc_id)
    end)
    |> Enum.reduce(MapSet.new(), fn page, acc ->
      collect_ancestor_ids(parents, page.parent_node_id, acc)
    end)
  end

  defp collect_ancestor_ids(_parents, nil, acc), do: acc

  defp collect_ancestor_ids(parents, node_id, acc) do
    if MapSet.member?(acc, node_id) do
      acc
    else
      collect_ancestor_ids(parents, Map.get(parents, node_id), MapSet.put(acc, node_id))
    end
  end

  defp page_create_event_doc_id(%DocTreeEvent{
         event_type: CMS.DocTree.Const.tree_event(:node_create),
         node_type: @tree_node_type_page,
         doc_id: doc_id
       })
       when not is_nil(doc_id) do
    doc_id
  end

  defp page_create_event_doc_id(_event), do: nil

  defp group_create_event_id(%DocTreeEvent{
         event_type: CMS.DocTree.Const.tree_event(:node_create),
         node_type: @tree_node_type_group,
         node_id: group_node_id
       })
       when not is_nil(group_node_id) do
    group_node_id
  end

  defp group_create_event_id(_event), do: nil

  defp tab_create_event_id(%DocTreeEvent{
         event_type: CMS.DocTree.Const.tree_event(:node_create),
         node_type: @tree_node_type_tab,
         node_id: tab_node_id
       }) do
    tab_node_id
  end

  defp tab_create_event_id(_event), do: nil

  defp shell_create_event_id(event) do
    group_create_event_id(event) || tab_create_event_id(event)
  end

  defp draft_doc_ids(%Community{} = community, branch) do
    DocDraft
    |> join(:inner, [draft], article in Article, on: article.id == draft.article_id)
    |> where([draft, article], article.community_id == ^community.id)
    |> where([draft, _article], draft.branch_id == ^branch.id)
    |> select([draft, _article], draft.article_id)
    |> Repo.all()
    |> MapSet.new()
  end

  defp tree_event_select_state(
         %Community{} = community,
         branch,
         %DocTreeEvent{
           event_type: CMS.DocTree.Const.tree_event(:node_create),
           node_type: @tree_node_type_page,
           doc_id: doc_id
         }
       ) do
    case draft_or_public_doc(community, branch, doc_id) do
      %Article{} -> {true, nil}
      _ -> {false, "Publish the page content first."}
    end
  end

  defp tree_event_select_state(_community, _branch, _event), do: {true, nil}

  defp draft_or_public_doc(%Community{} = community, branch, doc_id) do
    article = Repo.get_by(Article, id: doc_id, community_id: community.id, thread: :doc)

    if article &&
         (Repo.exists?(
            from(draft in DocDraft,
              where: draft.article_id == ^doc_id and draft.branch_id == ^branch.id
            )
          ) ||
            Repo.exists?(
              from(public in DocPublic,
                where: public.article_id == ^doc_id and public.branch_id == ^branch.id
              )
            )) do
      article
    end
  end

  defp public_doc(%Community{} = community, branch, article_id) do
    DocPublic
    |> join(:inner, [public], article in Article, on: article.id == public.article_id)
    |> where([public, article], article.community_id == ^community.id)
    |> where([public, _article], public.branch_id == ^branch.id)
    |> where([public, _article], public.article_id == ^article_id)
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
