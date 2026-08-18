defmodule Helper.Const do
  @moduledoc """
  Shared helper-level constants.

  Keep global, cross-domain values here. Domain-owned values should live in
  their own `*.Const` modules.

  Business position:

      Domain or web caller
        -> Const
        -> normalized value / infrastructure
  """

  use GroupherServer.Const

  const(default_error_code, do: 4000)
  const(gate_error_code_base, do: 4600)

  enum(error_code,
    do: [
      account_login: 4301,
      passport: 4302,
      changeset: 4102,
      custom: 4001,
      pagination: 4002,
      not_exist: 4003,
      already_did: 4004,
      self_conflict: 4005,
      react_fails: 4006,
      already_exist: 4007,
      update_fails: 4008,
      delete_fails: 4009,
      create_fails: 4010,
      editor_data_parse: 4014,
      service_auth: 4017,
      oauth_unlink: 4018,
      throttle_interval: 4201,
      throttle_hour: 4202,
      throttle_day: 4203,
      create_comment: 4401,
      comment_already_upvote: 4402,
      comment_pin_limit: 4403,
      too_much_pinned_article: 4501,
      already_collected_in_folder: 4502,
      delete_no_empty_collect_folder: 4503,
      private_collect_folder: 4504,
      mirror_article: 4505,
      invalid_domain_tag: 4506,
      undo_sink_old_article: 4507,
      article_comments_locked: 4508,
      require_questioner: 4509,
      archived: 4511,
      invalid_blog_title: 4513,
      already_upvoted: 4514,
      pending: 4515,
      article_not_found: 4516,
      resource_not_found: 4601,
      gate_resource_mismatch: 4602,
      doc_branch_required: 4603,
      lifecycle_not_found: 4604,
      ancestor_community_not_writable: 4605,
      ancestor_article_archived: 4606,
      ancestor_article_deleted: 4607,
      ancestor_article_destroyed: 4608,
      article_archived: 4609,
      article_deleted: 4610,
      article_destroyed: 4611,
      article_not_mutable: 4612,
      comment_deleted: 4613,
      comment_destroyed: 4614,
      article_comments_locked: 4615,
      permission_denied: 4616,
      unknown_action: 4617,
      lifecycle_not_loaded: 4618,
      scope_root_mismatch: 4619,
      scope_binding_conflict: 4620,
      scope_context_missing: 4621,
      unknown_policy_mode: 4622,
      scope_policy_actor_mismatch: 4623,
      gate_unknown: 4699,
      community_root_only: 5501,
      passport_community_not_match: 5502,
      one_community_only: 5503,
      emotion_not_allowed: 6001,
      thread_not_visible: 6002
    ]
  )
end
