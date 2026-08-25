defmodule GroupherServer.CMS.Gate.ErrorCat do
  @moduledoc """
  Stable domain errors for CMS Gate loading, policy, and callback contracts.

      Gate Load / Policy / with_check
        -> Gate.ErrorCat constructor
        -> Decision or normalized Command error
        -> GraphQL error adapter
  """

  use GroupherServer.ErrorCat.Domain, namespace: {:cms, :gate}

  error(:resource_not_found, code: 4601)
  error(:gate_resource_mismatch, code: 4602)

  error(:doc_branch_required,
    code: 4603,
    retryable: true,
    actions: [:return_to_list],
    message_key: "cms.gate.doc_branch_required"
  )

  error(:lifecycle_not_found, code: 4604)

  error(:ancestor_community_not_writable,
    code: 4605,
    actions: [:read_only_notice],
    message_key: "cms.gate.read_only"
  )

  error(:ancestor_article_archived,
    code: 4606,
    actions: [:read_only_notice],
    message_key: "cms.gate.read_only"
  )

  error(:ancestor_article_deleted,
    code: 4607,
    actions: [:return_to_list],
    message_key: "cms.gate.unavailable"
  )

  error(:ancestor_article_destroyed,
    code: 4608,
    actions: [:return_to_list],
    message_key: "cms.gate.unavailable"
  )

  error(:article_archived,
    code: 4609,
    actions: [:read_only_notice],
    message_key: "cms.gate.read_only"
  )

  error(:article_deleted,
    code: 4610,
    actions: [:return_to_list],
    message_key: "cms.gate.unavailable"
  )

  error(:article_destroyed,
    code: 4611,
    actions: [:return_to_list],
    message_key: "cms.gate.unavailable"
  )

  error(:article_not_mutable, code: 4612, message_key: "cms.gate.article_not_mutable")
  error(:article_not_deleted, code: 4624, message_key: "cms.gate.article_not_deleted")

  error(:comment_deleted,
    code: 4613,
    actions: [:return_to_list],
    message_key: "cms.gate.unavailable"
  )

  error(:comment_destroyed,
    code: 4614,
    actions: [:return_to_list],
    message_key: "cms.gate.unavailable"
  )

  error(:article_comments_locked, code: 4615)
  error(:permission_denied, code: 4616, message_key: "cms.gate.permission_denied")
  error(:unknown_action, code: 4617)

  error(:lifecycle_not_loaded,
    code: 4618,
    retryable: true,
    actions: [:retry],
    message_key: "cms.gate.lifecycle_not_loaded"
  )

  error(:scope_root_mismatch, code: 4619)
  error(:scope_binding_conflict, code: 4620)
  error(:scope_context_missing, code: 4621)
  error(:unknown_policy_mode, code: 4622)
  error(:scope_policy_actor_mismatch, code: 4623)
  error(:unsupported_resource, code: 4625)
  error(:throttle_interval, code: 4626)
  error(:throttle_hour, code: 4627)
  error(:throttle_day, code: 4628)
  error(:unexpected_callback_result, code: 4629)
  error(:solution_not_supported, code: 4630)
end
