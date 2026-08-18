defmodule GroupherServer.CMS.Gate.Scope.Registry do
  @moduledoc """
  Root-schema registry for typed Scope Context dispatch.

  Registry selects the resource compiler and rejects roots that cannot be
  represented by a Gate Scope Context. It does not compile policy itself.

      Gate.scope/4 -> Scope.Registry -> resource compiler -> Ecto.Query
  """

  alias GroupherServer.CMS.Gate.Context.Scope.{Article, Comment, Community, Doc, Document}
  alias GroupherServer.CMS.Gate.Scope.Article, as: ArticleCompiler
  alias GroupherServer.CMS.Gate.Scope.Comment, as: CommentCompiler
  alias GroupherServer.CMS.Gate.Scope.Community, as: CommunityCompiler
  alias GroupherServer.CMS.Gate.Scope.Document, as: DocumentCompiler
  alias GroupherServer.CMS.Gate.ErrorCat
  alias GroupherServer.CMS.Model.{ArticleDocument, Blog, Changelog, Post}
  alias GroupherServer.CMS.Model.Doc, as: DocModel

  @doc """
  Dispatches a query to the resource compiler selected by its root schema.

  The typed Scope Context must match the root schema; any other combination, or
  an unknown root, returns `{:error, CMS.Gate.ErrorCat.scope_root_mismatch()}`.

  ## Examples

      Registry.compile(query, actor, :read, Post, %Article{thread: :post})
      #=> Ecto.Query.t()

      Registry.compile(query, actor, :read, Post, %Community{policy_mode: :public})
      #=> {:error, CMS.Gate.ErrorCat.scope_root_mismatch()}

  """
  def compile(query, actor, action, root, %Community{} = context) do
    if root == GroupherServer.CMS.Model.Community,
      do: CommunityCompiler.scope(query, actor, action, context),
      else: {:error, ErrorCat.scope_root_mismatch()}
  end

  def compile(query, actor, action, root, %Article{} = context)
      when root in [Post, Blog, Changelog],
      do: ArticleCompiler.scope(query, actor, action, context)

  def compile(query, actor, action, DocModel, %Doc{} = context),
    do: ArticleCompiler.scope(query, actor, action, context)

  def compile(query, actor, action, GroupherServer.CMS.Model.Comment, %Comment{} = context),
    do: CommentCompiler.scope(query, actor, action, context)

  def compile(query, actor, action, ArticleDocument, %Document{} = context),
    do: DocumentCompiler.scope(query, actor, action, context)

  def compile(_query, _actor, _action, _root, _context),
    do: {:error, ErrorCat.scope_root_mismatch()}
end
