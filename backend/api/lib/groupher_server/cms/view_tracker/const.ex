defmodule GroupherServer.CMS.ViewTracker.Const do
  @moduledoc """
  Closed vocabulary for ViewTracker decisions and classifications.

      ViewTracker policy -> Const vocabulary -> ViewEvent
  """

  @actor_confidences [:verified, :probable, :unknown]
  @classified_by [
    :account_session,
    :agent_credential,
    :delegation_credential,
    :verified_crawler,
    :self_reported,
    :signed_anonymous_id,
    :fallback
  ]
  @decision_reasons [:counted, :duplicate_in_window, :excluded_by_policy]
  @read_purposes [
    :public_read,
    :author_preview,
    :moderation_review,
    :operations_inspection,
    :internal_probe
  ]
  @projection_states [:pending, :applied, :article_deleted, :dead_letter, :dropped]

  @doc "Returns the closed actor-confidence vocabulary."
  def actor_confidences, do: @actor_confidences

  @doc "Returns the closed classifier-source vocabulary."
  def classified_by, do: @classified_by

  @doc "Returns the closed ViewEvent decision vocabulary."
  def decision_reasons, do: @decision_reasons

  @doc "Returns the server-derived read-purpose vocabulary."
  def read_purposes, do: @read_purposes

  @doc "Returns the closed current-total projection vocabulary."
  def projection_states, do: @projection_states
end
