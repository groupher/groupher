defmodule GroupherServerWeb.Schema.AlertWall.Mutations do
  @moduledoc """
  User commands that organize AlertWall items.

  Business position:

      GraphQL mutation document
        -> AlertWall mutation field
          -> AlertWall resolver
  """

  use Helper.GqlSchemaSuite

  object :alert_wall_mutations do
    field :submit_report, non_null(:alert_report) do
      arg(:input, non_null(:alert_report_input))
      arg(:command_id, non_null(:id))
      middleware(M.Authorize, :login)
      resolve(&R.AlertWall.submit_report/3)
    end

    field :withdraw_report, non_null(:alert_report) do
      arg(:report_id, non_null(:id))
      arg(:command_id, non_null(:id))
      middleware(M.Authorize, :login)
      resolve(&R.AlertWall.withdraw_report/3)
    end

    field :resolve_alert_item, non_null(:alert_wall_command_result) do
      arg(:id, non_null(:id))
      arg(:resolution, non_null(:string))
      arg(:expected_version, non_null(:integer))
      arg(:command_id, non_null(:id))
      middleware(M.Authorize, :login)
      resolve(&R.AlertWall.resolve_alert_item/3)
    end
  end

  object :alert_wall_command_result do
    field(:item_id, non_null(:id))
    field(:resolution, non_null(:string))
  end
end
