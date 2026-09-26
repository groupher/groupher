defmodule GroupherServer.CMS.ViewTracker.Const do
  @moduledoc """
  Closed vocabulary for ViewTracker decisions and receipts.

      ViewTracker policy -> Const vocabulary -> synchronous receipt
  """

  @decision_reasons [:counted, :duplicate_in_window, :excluded_by_policy]
  @read_purposes [
    :public_read,
    :author_preview,
    :moderation_review,
    :operations_inspection,
    :internal_probe
  ]
  @receipt_states [:pending, :finalized]

  @doc "Returns every decision reason exposed by ViewTracker."
  def decision_reasons, do: @decision_reasons

  @doc "Returns decision reasons persisted in finalized receipts."
  def persisted_decision_reasons, do: [:counted, :duplicate_in_window]

  @doc "Returns the server-derived read-purpose vocabulary."
  def read_purposes, do: @read_purposes

  @doc "Returns the closed receipt state vocabulary."
  def receipt_states, do: @receipt_states
end
