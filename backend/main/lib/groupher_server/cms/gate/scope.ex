defmodule GroupherServer.CMS.Gate.Scope do
  @moduledoc """
  Dispatches CMS read-policy compilation by the root schema of an Ecto query.

  It never executes a Repo query; callers retain ownership of pagination,
  preloads, and execution.

  Business position:

      CMS read boundary
        -> Gate.Scope
        -> resource-specific scope compiler
        -> constrained Ecto query
        -> Repo owned by caller

  Example:

      iex> context = GroupherServer.CMS.Gate.Context.Scope.Community.public()
      iex> {:ok, %Ecto.Query{}} = scope(GroupherServer.CMS.Model.Community, nil, :read, context)
  """

  alias GroupherServer.CMS.Const

  alias GroupherServer.CMS.Gate.Context.Scope.{Article, Comment, Community, Doc, Document}
  alias GroupherServer.CMS.Gate.Scope.Registry

  require Const

  @doc "Compiles the requested read policy into the supplied queryable."
  @spec scope(Ecto.Queryable.t(), term(), atom(), GroupherServer.CMS.Gate.Context.Scope.t()) ::
          Ecto.Query.t() | {:error, atom()}
  def scope(queryable, actor, action, %Community{} = context) do
    query = Ecto.Queryable.to_query(queryable)

    Registry.compile(query, actor, action, root_schema(query), context)
  end

  def scope(queryable, actor, action, %Article{} = context) do
    query = Ecto.Queryable.to_query(queryable)

    Registry.compile(query, actor, action, root_schema(query), context)
  end

  def scope(queryable, actor, action, %Doc{} = context) do
    query = Ecto.Queryable.to_query(queryable)

    Registry.compile(query, actor, action, root_schema(query), context)
  end

  def scope(queryable, actor, action, %Comment{} = context) do
    query = Ecto.Queryable.to_query(queryable)

    Registry.compile(query, actor, action, root_schema(query), context)
  end

  def scope(queryable, actor, action, %Document{} = context) do
    query = Ecto.Queryable.to_query(queryable)

    Registry.compile(query, actor, action, root_schema(query), context)
  end

  def scope(_queryable, _actor, _action, _context),
    do: {:error, Const.gate_error(:scope_context_missing)}

  defp root_schema(%Ecto.Query{from: %{source: {_source, schema}}}), do: schema
  defp root_schema(_query), do: nil
end
