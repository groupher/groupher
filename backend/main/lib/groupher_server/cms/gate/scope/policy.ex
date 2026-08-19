defmodule GroupherServer.CMS.Gate.Scope.Policy do
  @moduledoc """
  Contract implemented by resource Scope compilers.

  A Scope policy receives a caller query and a typed Scope Context and returns
  the query constrained to the requested visibility boundary.

      Reader -> Gate.Scope -> Scope.Policy -> Ecto.Query
  """

  @doc "Compiles one resource-specific read policy into an Ecto query."

  @callback scope(
              query :: Ecto.Query.t(),
              actor :: term(),
              action :: atom(),
              context :: struct()
            ) :: Ecto.Query.t() | {:error, GroupherServer.ErrorCat.Error.t()}
end
