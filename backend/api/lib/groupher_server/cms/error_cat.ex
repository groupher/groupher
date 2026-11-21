defmodule GroupherServer.CMS.ErrorCat do
  @moduledoc """
  Shared CMS boundary error catalog.

  CMS operation -> catalog reason -> stable protocol error.
  """

  use GroupherServer.ErrorCat, namespace: {:cms}

  require GroupherServer.CMS.ContentPublishContract
  alias GroupherServer.CMS
  alias CMS.ContentPublishContract

  error(:invalid_article_path, code: 4501)
  error(:invalid_requirement, code: 4502)
  error(:missing_thread, code: 4503)
  error(:missing_community, code: 4504)
  error(:missing_passport, code: 4505)
  error(:invalid_body, code: 4506)
  error(:lifecycle_not_found, code: 4507)
  error(:lifecycle_state_conflict, code: 4508)
  error(:invalid_notify_payload, code: 4509)
  error(:not_configured, code: 4510)
  error(:community_not_persisted, code: 4511)
  error(:dashboard_not_found, code: 4512)
  error(:external_not_found, code: 4513)
  error(:external_unavailable, code: 4514, retryable: true)
  error(:unexpected_external_response, code: 4515)
  error(:invalid_plate_json, code: 4516)
  error(:invalid_event_type, code: 4517)
  error(:invalid_mention_type, code: 4518)
  error(:invalid_comment_link, code: 4519)
  error(:invalid_thread, code: 4520)
  error(:content_import_connection_create_failed, code: 4521, retryable: true)
  error(:content_import_has_no_ready_documents, code: 4522)
  error(:content_import_staged_body_missing, code: 4523)
  error(:content_import_job_not_found, code: 4524)
  error(:content_import_actor_not_found, code: 4525)
  error(:content_import_job_not_ready, code: 4526)
  error(:invalid_search_artiment, code: 4527)
  error(:not_searchable, code: 4528)
  error(:search_platform, code: 4529, retryable: true)
  error(:command_id_conflict, code: 4530)

  error(:command_resolution_pending,
    code: 4531,
    retryable: true,
    actions: [:retry, :reconcile]
  )

  error(:command_id_required, code: 4532)
  error(:command_id_invalid, code: 4535)
  error(:unsupported_command_resource, code: 4533)
  error(:command_result_unavailable, code: 4534, actions: [:reconcile])
  error(:command_result_expired, code: 4536, actions: [:reconcile])
  error(:command_invalid_result, code: 4537)
  error(:invalid_command_intent, code: 4538)

  ContentPublishContract.define_errors()

  error(:comment_body_not_found, code: 4541)
  error(:outbox_delivery_exhausted, code: 4542)
  error(:invalid_press_community_id, code: 4543)
  error(:unknown_press_outbox_event, code: 4544)
  error(:invalid_review_block, code: 4545)
  error(:review_transition_requires_transaction, code: 4546)
  error(:review_block_not_found, code: 4547)
  error(:review_content_changed, code: 4548)
  error(:mentions_graph_not_found, code: 4549)
  error(:mentions_graph_invalid_locator, code: 4550)
  error(:mentions_graph_invalid_cursor, code: 4551)
  error(:mentions_graph_invalid_request, code: 4553)
  error(:mentions_graph_integrity_error, code: 4554)
  error(:artiment_status_not_found, code: 4560)
  error(:last_unpublished_work, code: 4562)
  error(:work_in_use, code: 4563)
  error(:cover_edit_delete_failed, code: 4564)
  error(:working_copy_children_delete_failed, code: 4565)
  error(:docs_managed_content, code: 4566)
  error(:article_snapshot_not_found, code: 4567)
  error(:docs_restore_parent_missing, code: 4568)
  error(:docs_state_conflict, code: 4569, actions: [:reconcile])
  error(:docs_discard_confirmation_required, code: 4570, actions: [:reconcile])
  error(:docs_discard_confirmation_stale, code: 4571, actions: [:reconcile])
  error(:docs_restore_node_conflict, code: 4572, actions: [:reconcile])
  error(:docs_delete_diverged_tree, code: 4573, actions: [:reconcile])
  error(:docs_trash_in_use, code: 4574, actions: [:reconcile])
  error(:docs_invalid_merge_choice, code: 4575)
  error(:docs_approval_not_allowed, code: 4576, actions: [:reconcile])
  error(:docs_self_approval_forbidden, code: 4577)
  error(:docs_approval_required, code: 4578, actions: [:reconcile])
  error(:invalid_mention_notification_event, code: 4555)
  error(:mention_url_too_long, code: 4556)
end
