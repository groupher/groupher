defmodule GroupherServer.CMS.Review.Const do
  @moduledoc """
  Closed vocabulary for CMS review commands and restrictions.

      CMS review command/result
        -> Review.Const enums
          -> GraphQL and restriction boundaries
  """

  use GroupherServer.Const

  @result_actions [:approve, :reject, :recheck]
  @decision_actions [:approve, :reject]
  @restriction_types [
    :ai_review_hold,
    :human_review_hold,
    :ai_suspect_hold,
    :manual_hold,
    :report_threshold_hold
  ]
  @restriction_sources [:request, :human, :domain]
  @automated_restriction_types Enum.reject(@restriction_types, &(&1 == :manual_hold))
  @ai_clearable_restriction_types [:ai_review_hold, :human_review_hold, :ai_suspect_hold]

  enum(result_action, do: Enum.map(@result_actions, &{&1, &1}))
  enum(decision_action, do: Enum.map(@decision_actions, &{&1, &1}))
  enum(restriction_type, do: Enum.map(@restriction_types, &{&1, &1}))
  enum(restriction_source, do: Enum.map(@restriction_sources, &{&1, &1}))

  enum(automated_restriction_type,
    do: Enum.map(@automated_restriction_types, &{&1, &1})
  )

  enum(ai_clearable_restriction_type,
    do: Enum.map(@ai_clearable_restriction_types, &{&1, &1})
  )

  def restriction_types, do: @restriction_types
  def restriction_sources, do: @restriction_sources
  def decision_actions, do: @decision_actions
  def result_actions, do: @result_actions
  def automated_restriction_types, do: @automated_restriction_types
  def ai_clearable_restriction_types, do: @ai_clearable_restriction_types
end
