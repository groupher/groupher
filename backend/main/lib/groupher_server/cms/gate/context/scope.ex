defmodule GroupherServer.CMS.Gate.Context.Scope do
  @moduledoc """
  Union type for explicit resource read intents.

  Scope contexts are constructed by Readers and passed to `Gate.scope/4`.
  They contain no loaded resources and do not grant permission by themselves.

      Reader -> typed Scope context -> Gate.scope -> Ecto.Query

  This module defines only the union type. Use constructors on the concrete
  resource modules, such as `Context.Scope.Article.public/2`.
  """

  alias GroupherServer.CMS
  alias CMS.Gate
  alias Gate.Context.Scope.{Article, Comment, Community, Doc, Document}

  @type t :: Community.t() | Article.t() | Doc.t() | Comment.t() | Document.t()
end
