defmodule GroupherServerWeb.Schema.AlertWall.Queries do
  @moduledoc """
  AlertWall item queries.

  Business position:

      GraphQL query document
        -> AlertWall query field
          -> AlertWall resolver
  """

  use Helper.GqlSchemaSuite

  object :alert_wall_queries do
    @desc "Lists reports submitted by the current user."
    field :my_reports, non_null(:alert_report_page) do
      arg(:filter, :alert_report_filter)
      arg(:pagi, :pagi_input)
      middleware(M.Authorize, :login)
      resolve(&R.AlertWall.my_reports/3)
    end

    @desc "Lists alert items in the requested review scope."
    field :alert_items, non_null(:alert_item_page) do
      arg(:scope, non_null(:review_bot_scope_input))
      arg(:filter, :alert_item_filter)
      arg(:pagi, :pagi_input)
      middleware(M.Authorize, :login)
      resolve(&R.AlertWall.alert_items/3)
    end

    @desc "Loads an alert item by its ID."
    field :alert_item, :alert_item do
      arg(:id, non_null(:id))
      middleware(M.Authorize, :login)
      resolve(&R.AlertWall.alert_item/3)
    end

    @desc "Lists reports associated with an alert item."
    field :alert_item_reports, non_null(:alert_report_page) do
      arg(:id, non_null(:id))
      arg(:pagi, :pagi_input)
      middleware(M.Authorize, :login)
      resolve(&R.AlertWall.item_reports/3)
    end
  end
end
