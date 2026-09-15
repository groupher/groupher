defmodule GroupherServer.CMS.Gate.Scope.Query do
  @moduledoc """
  Builds and dispatches typed Scope queries by root schema.

  Query selects the resource Scope implementation and rejects roots that cannot
  be represented by a Gate Scope Context. It does not own resource policy.

      Gate.scope/4 -> Scope.Query.build/5 -> resource Scope -> Ecto.Query
  """

  alias GroupherServer.CMS

  alias CMS.Gate.Context.Scope.Article, as: ArticleContext
  alias CMS.Gate.Context.Scope.Comment, as: CommentContext
  alias CMS.Gate.Context.Scope.Community, as: CommunityContext
  alias CMS.Gate.Context.Scope.Doc, as: DocContext
  alias CMS.Gate.Context.Scope.Document, as: DocumentContext
  alias CMS.Gate.ErrorCat
  alias CMS.Model.{ArticleDocument, Blog, Changelog, Comment, Community, Doc, Post}

  @doc "Builds a resource Scope query selected by root schema and Context type."
  def build(query, actor, action, Community, %CommunityContext{} = context),
    do: CMS.Gate.Scope.Community.scope(query, actor, action, context)

  def build(query, actor, action, root, %ArticleContext{} = context)
      when root in [Post, Blog, Changelog],
      do: CMS.Gate.Scope.Article.scope(query, actor, action, context)

  def build(query, actor, action, Doc, %DocContext{} = context),
    do: CMS.Gate.Scope.Article.scope(query, actor, action, context)

  def build(query, actor, action, Comment, %CommentContext{} = context),
    do: CMS.Gate.Scope.Comment.scope(query, actor, action, context)

  def build(query, actor, action, ArticleDocument, %DocumentContext{} = context),
    do: CMS.Gate.Scope.Document.scope(query, actor, action, context)

  def build(_query, _actor, _action, _root, context) when not is_struct(context),
    do: {:error, ErrorCat.scope_context_missing()}

  def build(_query, _actor, _action, _root, _context),
    do: {:error, ErrorCat.scope_root_mismatch()}
end
