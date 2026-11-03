defmodule GroupherServer.CMS.Review.Const do
  @moduledoc """
  Closed vocabulary for CMS review commands and restrictions.
  """

  use GroupherServer.Const

  enum(result_action, do: [approve: :approve, reject: :reject, recheck: :recheck])
  enum(decision_action, do: [approve: :approve, reject: :reject])

  enum(restriction_type,
    do: [
      ai_review_hold: :ai_review_hold,
      human_review_hold: :human_review_hold,
      ai_suspect_hold: :ai_suspect_hold,
      manual_hold: :manual_hold,
      report_threshold_hold: :report_threshold_hold
    ]
  )

  enum(restriction_source, do: [request: :request, human: :human, domain: :domain])

  def restriction_type_values do
    [:ai_review_hold, :human_review_hold, :ai_suspect_hold, :manual_hold, :report_threshold_hold]
  end

  def restriction_source_values, do: [:request, :human, :domain]
  def result_action_values, do: [:approve, :reject, :recheck]
  def decision_action_values, do: [:approve, :reject]

  def active?(%{resolved_at: nil, resolution_ref: nil}), do: true
  def active?(_restriction), do: false
end
