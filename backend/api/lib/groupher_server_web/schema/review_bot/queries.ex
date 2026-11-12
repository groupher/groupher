defmodule GroupherServerWeb.Schema.ReviewBot.Queries do
  @moduledoc """
  ReviewBot policy queries.

  Business position:

      GraphQL ReviewBot configuration query
        -> config field
          -> ReviewBot resolver
  """

  use Helper.GqlSchemaSuite

  object :review_bot_queries do
    @desc "Loads ReviewBot policy for a scope and subject type."
    field :review_bot_config, non_null(:review_bot_config) do
      arg(:scope, non_null(:review_bot_scope_input))
      arg(:subject_type, non_null(:review_bot_subject_type))
      middleware(M.Authorize, :login)
      resolve(&R.ReviewBot.review_bot_config/3)
    end
  end
end
