defmodule GroupherServer.CMS.Gate.Access do
  @moduledoc """
  Internal Access facade for single-resource access checks.

  This module deliberately contains no loading, locking, transaction, or
  policy logic. It routes the public Gate entry point to the resource-specific
  check flow and exposes the resource policy contract for Gate-internal calls.

      CMS.Gate.access_check(actor, action, resource)
        -> Gate.Access
        -> Access.Check.{Community, Article, Comment}
        -> Access.Loader + resource policy
        -> Gate.Decision

  Resource policies are exposed under `Gate.Access.{Community, Article,
  Comment}` for Gate-internal composition and return only `:ok` or
  `{:error, reason}`.
  """

  alias GroupherServer.CMS.Gate.Access.Check
  alias GroupherServer.CMS.Gate.Access.Article, as: ArticlePolicy
  alias GroupherServer.CMS.Gate.Access.Comment, as: CommentPolicy
  alias GroupherServer.CMS.Gate.Access.Community, as: CommunityPolicy
  alias GroupherServer.CMS.Gate.Context.Access.Community, as: CommunityContext
  alias GroupherServer.CMS.Model.{Comment, Community}

  @doc false
  @spec access_check(term(), atom(), term()) ::
          {:ok, term()} | {:error, GroupherServer.CMS.Gate.Decision.t()}
  def access_check(actor, action, %Community{} = resource),
    do: Check.Community.run(actor, action, resource)

  def access_check(actor, action, %Comment{} = resource),
    do: Check.Comment.run(actor, action, resource)

  def access_check(actor, action, resource),
    do: Check.Article.run(actor, action, resource)

  @doc false
  @spec check_access(term(), atom(), term()) :: :ok | {:error, atom()}
  def check_access(actor, action, %Community{} = resource),
    do: CommunityPolicy.check_access(actor, action, resource)

  @doc false
  @spec check_access(term(), atom(), term(), struct()) :: :ok | {:error, atom()}
  def check_access(actor, action, %Community{} = resource, %CommunityContext{} = context),
    do: CommunityPolicy.check_access(actor, action, resource, context)

  def check_access(actor, action, %Comment{} = resource, context),
    do: CommentPolicy.check_access(actor, action, resource, context)

  def check_access(actor, action, resource, context),
    do: ArticlePolicy.check_access(actor, action, resource, context)
end
