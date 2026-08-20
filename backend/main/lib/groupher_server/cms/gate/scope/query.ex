defmodule GroupherServer.CMS.Gate.Scope.Query do
  @moduledoc """
  Builds and dispatches typed Scope queries by root schema.

  Query selects the resource Scope implementation and rejects roots that cannot
  be represented by a Gate Scope Context. It does not own resource policy.

      Gate.scope/4 -> Scope.Query.build/5 -> resource Scope -> Ecto.Query
  """

  alias GroupherServer.CMS.Gate
  alias GroupherServer.CMS.Gate.Context.Scope.{Article, Comment, Community, Doc, Document}
  alias GroupherServer.CMS.Gate.ErrorCat
  alias GroupherServer.CMS.Model.{ArticleDocument, Blog, Changelog, Post}
  alias GroupherServer.CMS.Model.Comment, as: CommentModel
  alias GroupherServer.CMS.Model.Community, as: CommunityModel
  alias GroupherServer.CMS.Model.Doc, as: DocModel

  @doc "Builds a resource Scope query selected by root schema and Context type."
  def build(query, actor, action, CommunityModel, %Community{} = context),
    do: Gate.Scope.Community.scope(query, actor, action, context)

  def build(query, actor, action, root, %Article{} = context)
      when root in [Post, Blog, Changelog],
      do: Gate.Scope.Article.scope(query, actor, action, context)

  def build(query, actor, action, DocModel, %Doc{} = context),
    do: Gate.Scope.Article.scope(query, actor, action, context)

  def build(query, actor, action, CommentModel, %Comment{} = context),
    do: Gate.Scope.Comment.scope(query, actor, action, context)

  def build(query, actor, action, ArticleDocument, %Document{} = context),
    do: Gate.Scope.Document.scope(query, actor, action, context)

  def build(_query, _actor, _action, _root, context) when not is_struct(context),
    do: {:error, ErrorCat.scope_context_missing()}

  def build(_query, _actor, _action, _root, _context),
    do: {:error, ErrorCat.scope_root_mismatch()}
end
