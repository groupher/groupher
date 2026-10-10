defmodule GroupherServer.CMS.Gate.Const do
  @moduledoc """
  Closed authorization vocabulary owned by CMS Gate.

      CMS policy request -> Gate.Const -> scope and access decision
  """

  use GroupherServer.Const

  enum passport_action do
    [
      community_application_review: "community.application.review",
      community_application_approve: "community.application.approve",
      community_application_reject: "community.application.reject",
      community_application_retry_creation: "community.application.retry_creation",
      community_application_retry_setup: "community.application.retry_setup",
      community_update: "community.update",
      category_create: "category.create",
      category_update: "category.update",
      category_delete: "category.delete",
      category_set: "category.set",
      category_unset: "category.unset",
      community_request_destroy: "community.request_destroy",
      article_insights_read: "article.insights.read"
    ]
  end

  enum gate_action do
    [
      read: :read,
      read_draft: :read_draft,
      list: :list,
      read_insights: :read_insights,
      update: :update,
      category_create: :category_create,
      category_update: :category_update,
      category_delete: :category_delete,
      category_set: :category_set,
      category_unset: :category_unset,
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
end
