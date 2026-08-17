defmodule GroupherServer.CMS.Gate do
  @moduledoc """
  Public facade for CMS operation admission.

  Gate exposes only two product-facing operations:

    * `scope/3-4` compiles a query boundary without executing it;
    * `access_check/3` loads, locks, and checks one mutation resource.

  Allow, Passport, and PublishThrottle are separate internal seams and are not
  re-exported from this facade.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Gate
        -> Repo / external boundary
  """

  alias __MODULE__.{Access, Decision, Scope}

  @doc "Builds a read query with Gate policies without executing it."
  @spec scope(Ecto.Queryable.t(), term(), atom()) :: Ecto.Query.t() | {:error, atom()}
  def scope(queryable, actor, action),
    do: scope(queryable, actor, action, %{policy_mode: :public})

  @spec scope(Ecto.Queryable.t(), term(), atom(), map()) ::
          Ecto.Query.t() | {:error, atom()}
  def scope(queryable, actor, action, context),
    do: Scope.scope(queryable, actor, action, context)

  @doc "Loads, locks, and checks a resource inside the current mutation transaction."
  defdelegate access_check(user, action, resource), to: Access

  @doc "Checks a resource with an explicit Gate policy context."
  def access_check(user, :read_draft, resource, context),
    do: Access.access_check(user, :read_draft, resource, context)

  def access_check(_user, _action, _resource, _context),
    do: {:error, Decision.deny(:unknown_action)}
end
