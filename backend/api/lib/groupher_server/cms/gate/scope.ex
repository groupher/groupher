defmodule GroupherServer.CMS.Gate.Scope do
  @moduledoc """
  Builds CMS read queries by the root schema of an Ecto query.

  It never executes a Repo query; callers retain ownership of pagination,
  preloads, and execution.

  Business position:

      CMS read boundary
        -> Gate.Scope
        -> resource-specific Scope query
        -> constrained Ecto query
        -> Repo owned by caller

  Example:

      iex> context = GroupherServer.CMS.Gate.Context.Scope.Community.public()
      iex> {:ok, %Ecto.Query{}} = scope(GroupherServer.CMS.Model.Community, nil, :read, context)
  """

  alias GroupherServer.CMS.Gate.ErrorCat
  alias GroupherServer.CMS.Gate.Scope.Query

  @doc "Builds the requested read scope into the supplied queryable."
  @spec scope(Ecto.Queryable.t(), term(), atom(), GroupherServer.CMS.Gate.Context.Scope.t()) ::
          Ecto.Query.t() | {:error, GroupherServer.ErrorCat.Error.t()}
  def scope(queryable, actor, action, context) when is_struct(context) do
    query = Ecto.Queryable.to_query(queryable)

    Query.build(query, actor, action, root_schema(query), context)
  end

  def scope(_queryable, _actor, _action, _context),
    do: {:error, ErrorCat.scope_context_missing()}

  defp root_schema(%Ecto.Query{from: %{source: {_source, schema}}}), do: schema
  defp root_schema(_query), do: nil
end
