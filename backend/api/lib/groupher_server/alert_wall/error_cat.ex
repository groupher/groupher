defmodule GroupherServer.AlertWall.ErrorCat do
  @moduledoc """
  Stable errors for Wall item, report and action contracts.

  Business position:

      AlertWall commands and queries
        -> stable Wall error codes
          -> GraphQL error presentation
  """

  use GroupherServer.ErrorCat, namespace: {:alert_wall, :item}

  error(:invalid_item, code: 7601)
  error(:item_not_found, code: 7602)
  error(:operation_conflict, code: 7603)
  error(:invalid_report, code: 7604)
  error(:report_not_found, code: 7605)
  error(:requires_transaction, code: 7606)
end
