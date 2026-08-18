defmodule Helper.GqlSchemaSuite do
  @moduledoc """
  Shared `use` macro for Groupher Absinthe schema modules.

  It imports Absinthe notation and exposes the canonical Middleware (`M`) and
  Resolver (`R`) aliases without making domain modules depend on web concerns.

  Business position:

      Domain or web caller
        -> GqlSchemaSuite
        -> normalized value / infrastructure
  """

  @doc "Injects Absinthe notation and the standard web-layer aliases."
  defmacro __using__(_opts) do
    quote do
      use Absinthe.Schema.Notation

      alias GroupherServerWeb.Middleware, as: M
      alias GroupherServerWeb.Resolvers, as: R
    end
  end
end
