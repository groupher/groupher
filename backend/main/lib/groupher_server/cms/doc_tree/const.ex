defmodule GroupherServer.CMS.DocTree.Const do
  @moduledoc """
  Closed Docs Tree event, projection, and publish vocabulary.

      Docs Tree command -> DocTree.Const -> event and projection workflow
  """

  use GroupherServer.Const

  enum tree_node_type do
    [tab: :tab, group: :group, page: :page, link: :link, pin: :pin]
  end

  enum tree_event_status do
    [staged: :staged, published: :published, reverted: :reverted, discarded: :discarded]
  end

  enum(tree_event_owner, do: [tree: :tree, doc: :doc])

  @doc "Maximum depth of a Docs Tree node, counting a root Tab as depth zero."
  @spec max_depth() :: pos_integer()
  def max_depth, do: 32

  enum doc_tree_json_key do
    [node: "node", id: "id", type: "type", doc_id: "docId"]
  end

  enum(doc_tree_trash_snapshot_key, do: [draft_doc: "draftDoc"])

  enum doc_publish_input_key do
    [
      doc_change_ids: :doc_change_ids,
      tree_change_ids: :tree_change_ids,
      restore_tree_change_ids: :restore_tree_change_ids
    ]
  end

  enum(doc_publish_flow, do: [noop: :noop, publish: :publish, restore: :restore])

  enum tree_event do
    [
      group_rename: "group.rename",
      node_rename: "node.rename",
      node_move: "node.move",
      node_marker_update: "node.marker.update",
      link_href_update: "link.href.update",
      node_update: "node.update",
      node_create: "node.create",
      node_delete: "node.delete",
      pin_add: "pin.add",
      pin_remove: "pin.remove",
      pin_reorder: "pin.reorder",
      pin_update: "pin.update"
    ]
  end

  enum(publish_request_target_type, do: [doc: "doc", doc_tree: "doc_tree"])

  enum publish_request_status do
    [pending: :pending, approved: :approved, rejected: :rejected, canceled: :canceled]
  end
end
