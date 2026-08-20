defmodule GroupherServer.CMS.Gate.Context.Access do
  @moduledoc """
  Union type for Gate-owned mutation admission facts.

  Access contexts are constructed only by Gate resource loaders and consumed by
  resource access policies. Readers and writers do not construct or persist
  them.

      Gate.access_check
        -> resource loader
        -> typed Access context
        -> resource policy
      -> Gate.Decision

  This module defines only the union type. Use the resource-specific Context
  structs returned by Gate loaders; callers must not construct `%Context.Access{}`.
  """

  alias GroupherServer.CMS
  alias CMS.Gate
  alias Gate.Context.Access.{Article, Comment, Community, Doc}

  @type t :: Community.t() | Article.t() | Doc.t() | Comment.t()
end
