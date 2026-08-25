defmodule GroupherServer.CMS.Gate do
  @moduledoc """
  Public facade for CMS operation admission.

  Gate exposes only two product-facing operations:

    * `scope/4` compiles a query boundary without executing it;
    * `access_check/3` loads, locks, and checks one mutation resource.

  Community Enable, Passport, and publish rate limiting are separate internal
  seams and are not re-exported from this facade.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Gate
        -> Repo / external boundary

  Examples:

      iex> context = CMS.Gate.Context.Scope.Article.public(:post)
      iex> {:ok, query} = CMS.Gate.scope(GroupherServer.CMS.Model.Post, nil, :read, context)
      iex> %Ecto.Query{} = query

      iex> {:ok, _community} = CMS.Gate.access_check(actor, :update, community)
  """

  alias __MODULE__.{Access, Scope}

  @doc "Builds a read query with a resource-specific Scope Context."
  @spec scope(Ecto.Queryable.t(), term(), atom(), GroupherServer.CMS.Gate.Context.Scope.t()) ::
          Ecto.Query.t() | {:error, GroupherServer.ErrorCat.Error.t()}
  def scope(queryable, actor, action, context),
    do: Scope.scope(queryable, actor, action, context)

  @doc "Loads, locks, and checks a resource inside the current mutation transaction."
  defdelegate access_check(user, action, resource), to: Access
end
