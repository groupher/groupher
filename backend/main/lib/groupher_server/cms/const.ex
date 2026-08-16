defmodule GroupherServer.CMS.Const do
  @moduledoc """
  Shared CMS domain constants.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Const
        -> Repo / external boundary
  """

  use GroupherServer.Const

  enum(stage, do: [draft: :draft, public: :public])

  enum passport_action do
    [
      community_application_review: "community.application.review",
      community_application_approve: "community.application.approve",
      community_application_reject: "community.application.reject",
      community_application_retry_creation: "community.application.retry_creation",
      community_application_retry_setup: "community.application.retry_setup",
      community_update: "community.update",
      community_request_destroy: "community.request_destroy"
    ]
  end

  enum gate_action do
    [
      read: :read,
      read_draft: :read_draft,
      list: :list,
      update: :update,
      publish: :publish,
      create_comment: :create_comment,
      reply_comment: :reply_comment,
      request_destroy: :request_destroy,
      manage_docs: :manage_docs,
      restore: :restore,
      schedule_destroy: :schedule_destroy,
      cancel_destroy: :cancel_destroy,
      destroy: :destroy
    ]
  end

  enum gate_error do
    [
      scope_root_mismatch: :scope_root_mismatch,
      scope_binding_conflict: :scope_binding_conflict,
      scope_context_missing: :scope_context_missing,
      unknown_policy_mode: :unknown_policy_mode,
      scope_policy_actor_mismatch: :scope_policy_actor_mismatch
    ]
  end

  enum lifecycle_state do
    [
      setting_up: :setting_up,
      setup_failed: :setup_failed,
      active: :active,
      read_only: :read_only,
      suspended: :suspended,
      archived: :archived,
      pending_destroy: :pending_destroy,
      destroy: :destroy
    ]
  end

  enum lifecycle_blocker_type do
    [
      owner_archive: :owner_archive,
      moderation_suspend: :moderation_suspend,
      moderation_archive: :moderation_archive,
      ops_legal_hold: :ops_legal_hold
    ]
  end

  enum lifecycle_blocker_end_type do
    [released: :released, terminated: :terminated]
  end

  enum(doc_branch_type, do: [main: :main, preview: :preview])
  enum(doc_branch_status, do: [active: :active, archived: :archived])

  enum doc_snapshot_action do
    [
      checkpoint: :checkpoint,
      publish: :publish,
      fork: :fork,
      promote: :promote,
      restore: :restore
    ]
  end

  enum tree_node_type do
    [
      tab: :tab,
      group: :group,
      page: :page,
      link: :link,
      pin: :pin
    ]
  end

  enum(cover_view, do: [public: :public, dashboard: :dashboard])

  enum tree_event_status do
    [
      staged: :staged,
      published: :published,
      reverted: :reverted,
      discarded: :discarded
    ]
  end

  enum(tree_event_owner, do: [tree: :tree, doc: :doc])

  @doc "Maximum depth of a Docs Tree node, counting a root Tab as depth zero."
  @spec doc_tree_max_depth() :: pos_integer()
  def doc_tree_max_depth, do: 32

  enum doc_tree_json_key do
    [
      node: "node",
      id: "id",
      type: "type",
      doc_id: "docId"
    ]
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
    [
      pending: :pending,
      approved: :approved,
      rejected: :rejected,
      canceled: :canceled
    ]
  end

  enum release_article_action do
    [
      created: "created",
      modified: "modified",
      deleted: "deleted",
      renamed: "renamed",
      moved: "moved",
      unchanged: "unchanged"
    ]
  end
end
