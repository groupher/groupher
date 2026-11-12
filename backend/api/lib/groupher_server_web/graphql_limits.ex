defmodule GroupherServerWeb.GraphQLLimits do
  @moduledoc """
  Shared limits for the CSRF precheck and Absinthe execution.

  Business position:

      GraphQL document -> parser and complexity limits -> execution
  """

  @token_limit 20_000
  @max_complexity 500

  @doc "Returns the maximum number of parseable GraphQL tokens per document."
  def token_limit, do: @token_limit

  @doc "Returns the maximum unweighted GraphQL field complexity per operation."
  def max_complexity, do: @max_complexity
end
