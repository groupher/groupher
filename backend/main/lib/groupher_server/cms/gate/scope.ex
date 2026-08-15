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
  """

  alias GroupherServer.CMS.Const
  alias GroupherServer.CMS.Gate.Scope.{Article, Comment, Community, Document}
  alias GroupherServer.CMS.Model.{ArticleDocument, Blog, Changelog, Doc, Post}

  require Const

  @doc "Compiles the requested read policy into the supplied queryable."
  @spec scope(Ecto.Queryable.t(), term(), atom(), map()) ::
          Ecto.Query.t() | {:error, atom()}
  def scope(queryable, actor, action, context) when is_map(context) do
    query = Ecto.Queryable.to_query(queryable)

    case root_schema(query) do
      GroupherServer.CMS.Model.Community -> Community.scope(query, actor, action, context)
      Post -> Article.scope(query, actor, action, context)
      Blog -> Article.scope(query, actor, action, context)
      Changelog -> Article.scope(query, actor, action, context)
      Doc -> Article.scope(query, actor, action, context)
      GroupherServer.CMS.Model.Comment -> Comment.scope(query, actor, action, context)
      ArticleDocument -> Document.scope(query, actor, action, context)
      _ -> {:error, Const.gate_error(:scope_root_mismatch)}
    end
  end

  defp root_schema(%Ecto.Query{from: %{source: {_source, schema}}}), do: schema
  defp root_schema(_query), do: nil
end
