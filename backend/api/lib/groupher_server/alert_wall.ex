defmodule GroupherServer.AlertWall do
  @moduledoc """
  Public boundary for scoped risk items, user reports and Wall actions.

      CMS / Accounts command -> AlertWall interface -> alert_wall facts
  """

  alias GroupherServer.AlertWall
  alias AlertWall.{Persist, Query}

  @doc "Returns the missing AlertWall item error."
  defdelegate item_not_found_error(), to: GroupherServer.AlertWall.ErrorCat, as: :item_not_found

  @doc "Returns the invalid AlertWall report error."
  defdelegate invalid_report_error(), to: GroupherServer.AlertWall.ErrorCat, as: :invalid_report

  @doc "Lists open items visible to a scoped reviewer."
  defdelegate list_items(scope, filter, actor, pagi \\ nil), to: Query

  @doc "Loads one reviewer-visible item."
  defdelegate item(item_id, actor), to: Query

  @doc "Lists the current user's report history."
  defdelegate my_reports(actor, filter, pagi \\ nil), to: Query

  @doc "Counts active reports authored by an account."
  defdelegate reported_count(user_id), to: Query

  @doc "Runs an authorized, Receipt-backed resolution of one Wall item."
  defdelegate resolve_item(item_id, resolution, expected_version, actor, command_id),
    to: GroupherServer.AlertWall.Commands.Resolve,
    as: :execute

  @doc "Runs a CMS target report through the shared CommandPipeline Receipt."
  defdelegate submit_report(target, report_type, details, actor, command_id),
    to: GroupherServer.AlertWall.Commands.SubmitReport,
    as: :execute

  @doc "Withdraws one report owned by the current account through a Receipt-backed command."
  defdelegate withdraw_report(report_id, actor, command_id),
    to: GroupherServer.AlertWall.Commands.WithdrawReport,
    as: :execute

  @doc "Adds or updates an item from a trusted owner inside its transaction."
  defdelegate add_in_transaction(attrs, operation_ref), to: Persist

  @doc "Resolves an item while retaining its full history."
  defdelegate resolve_in_transaction(item_id, resolution, operation_ref, actor), to: Persist

  @doc "Supersedes an item whose subject is no longer current."
  defdelegate supersede_in_transaction(item_id, operation_ref, source), to: Persist

  @doc "Creates one report attached to the item for the reported content."
  defdelegate submit_report_in_transaction(attrs, operation_ref), to: Persist

  @doc "Withdraws one reporter-owned report and returns all items whose projection may change."
  defdelegate withdraw_report_in_transaction(report_id, reporter_id), to: Persist

  @doc "Counts unresolved reports that still apply to an item."
  defdelegate active_report_count(item_id), to: Persist

  @doc "Supersedes a current CMS item when its source review request is replaced."
  defdelegate supersede_ai_source_in_transaction(request_id, operation_ref), to: Persist

  @doc "Marks open items for a permanently deleted CMS target while retaining their history."
  defdelegate mark_target_deleted_in_transaction(target_type, target_id, operation_ref),
    to: Persist

  @doc "Tombstones open Accounts-owned user items when their account target is removed."
  defdelegate mark_account_target_deleted_in_transaction(target_type, target_id, operation_ref),
    to: Persist

  @doc "Resolves an open CMS item sourced from one review request."
  defdelegate resolve_ai_source_in_transaction(request_id, resolution, operation_ref), to: Persist

  @doc "Replaces the complete AI opinion only when a matching open item exists."
  defdelegate replace_ai_opinion_in_transaction(attrs), to: Persist

  @doc "Resolves an AI item after its CMS owner clears the current suspicion."
  defdelegate resolve_from_cms_in_transaction(item_id, resolution, operation_ref), to: Persist
end
