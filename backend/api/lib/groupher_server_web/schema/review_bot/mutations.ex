defmodule GroupherServerWeb.Schema.ReviewBot.Mutations do
  @moduledoc """
  Receipt-backed ReviewBot policy mutations.

  Business position:

      GraphQL ReviewBot configuration mutation
        -> config update field
          -> ReviewBot resolver
  """

  use Helper.GqlSchemaSuite

  object :review_bot_mutations do
    field :update_review_bot_config, non_null(:review_bot_config) do
      arg(:input, non_null(:update_review_bot_config_input))
      arg(:command_id, non_null(:id))
      middleware(M.Authorize, :login)
      resolve(&R.ReviewBot.update_review_bot_config/3)
    end
  end
end
