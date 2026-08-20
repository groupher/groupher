defmodule GroupherServer.CMS.Gate.Access.Policy do
  @moduledoc """
  Applies resource-state admission rules to already-loaded Gate contexts.

  Policy functions do not query, lock, or open transactions. Each function is
  named after the resource whose rules it applies.

  Business position:

      typed Access Context
        -> Access.Policy resource function
        -> allow or declared Gate error
        -> Access.Check Decision conversion
  """

  alias __MODULE__.{Article, Comment, Community}
  alias GroupherServer.CMS
  alias CMS.Gate
  alias Gate.Context.Access.Community, as: CommunityContext

  @doc false
  def article(actor, action, resource, context),
    do: Article.check_access(actor, action, resource, context)

  @doc false
  def comment(actor, action, resource, context),
    do: Comment.check_access(actor, action, resource, context)

  @doc false
  def community(actor, action, resource),
    do: Community.check_access(actor, action, resource)

  @doc false
  def community(actor, action, resource, %CommunityContext{} = context),
    do: Community.check_access(actor, action, resource, context)
end
