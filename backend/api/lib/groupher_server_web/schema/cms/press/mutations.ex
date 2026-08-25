defmodule GroupherServerWeb.Schema.CMS.Press.Mutations do
  @moduledoc """
  Dashboard mutation boundary for CMS.Press configuration.

  Business position:

      Client
        -> Absinthe schema / Mutations
        -> resolver or domain context
        -> GraphQL response
  """

  use Helper.GqlSchemaSuite

  object :cms_press_mutations do
    field :update_press_config, :press_config_payload do
      arg(:input, non_null(:update_press_config_input))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "dashboard.rss.update")
      resolve(&R.CMS.update_press_config/3)
    end
  end
end
