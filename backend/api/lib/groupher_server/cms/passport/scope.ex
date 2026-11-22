defmodule GroupherServer.CMS.Passport.Scope do
  @moduledoc """
  Exposes Passport scope predicates while preserving the resource-specific facts.

      Passport -> Scope -> Query -> composable authorization predicate
  """

  @doc "Applies actor-bound Passport authorization to an Article query."
  defdelegate articles(query, actor, scope, action), to: __MODULE__.Query
end
