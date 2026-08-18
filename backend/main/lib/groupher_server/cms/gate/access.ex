defmodule GroupherServer.CMS.Gate.Access do
  @moduledoc """
  Internal Access facade for single-resource access checks.

  This module contains no loading, locking, transaction, or policy logic. It
  routes supported structs to the resource-specific check flow and converts an
  unsupported input type into a stable fail-closed Decision.

      CMS.Gate.access_check(actor, action, resource)
        -> Gate.Access
        -> Access.Check.community/article/comment
        -> Access.Load + Access.Policy
        -> Gate.Decision

  Resource policies are exposed through `Gate.Access.Policy` and return only
  `:ok` or `{:error, reason}`.
  """

  alias GroupherServer.CMS.Gate.Access.Check
  alias GroupherServer.CMS.Gate.Decision
  alias GroupherServer.CMS.Gate.ErrorCat
  alias GroupherServer.CMS.Model.{Blog, Changelog, Comment, Community, Doc, Post}

  @doc false
  @spec access_check(term(), atom(), term()) ::
          {:ok, term()} | {:error, GroupherServer.CMS.Gate.Decision.t()}
  def access_check(actor, action, %Community{} = resource),
    do: Check.community(actor, action, resource)

  def access_check(actor, action, %Comment{} = resource),
    do: Check.comment(actor, action, resource)

  def access_check(actor, action, %model{} = resource)
      when model in [Post, Blog, Changelog, Doc],
      do: Check.article(actor, action, resource)

  def access_check(_actor, _action, _resource),
    do: {:error, Decision.deny(ErrorCat.unsupported_resource())}
end
