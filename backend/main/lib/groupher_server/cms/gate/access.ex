defmodule GroupherServer.CMS.Gate.Access do
  @moduledoc """
  Internal Access facade for single-resource access checks.

  This module owns the public orchestration boundary. Resource-specific loading
  and policy evaluation remain in `Access.Check`; aggregate commands enter the
  transaction and lock through `with_check/4`.

      Simple check
        -> access_check -> short transaction -> Decision

      Aggregate command
        -> with_check -> aggregate transaction + lock
             -> canonical load + policy -> command callback
             -> commit / rollback

  Resource policies are exposed through `Gate.Access.Policy` and return only
  `:ok` or `{:error, reason}`.
  """

  alias GroupherServer.CMS.Gate.Access.Check
  alias GroupherServer.CMS.Gate.Decision
  alias GroupherServer.CMS.Gate.ErrorCat
  alias GroupherServer.CMS.{Articles, FrontDesk}
  alias GroupherServer.CMS.Model.{Blog, Changelog, Comment, Community, Doc, Post}
  alias GroupherServer.Repo

  @doc """
  Authorizes one resource and returns its canonical loaded representation.

  This compatibility entry is appropriate for a check that does not own a
  larger command callback. Aggregate commands should use `with_check/4`.

  ## Examples

      Gate.Access.access_check(actor, :edit, comment)
      #=> {:ok, canonical_comment} | {:error, %Gate.Decision{}}
  """
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

  @doc """
  Runs authorization and a command callback in one aggregate transaction.

  The callback receives the canonical resource loaded after the advisory lock
  is acquired. It must return `{:ok, result}` or `{:error, reason}`; any other
  shape becomes `unexpected_callback_result`, while raise/throw/exit propagate
  after rollback.

  ## Examples

      Gate.Access.with_check(actor, :edit, comment, fn canonical ->
        ORM.update(canonical, attrs)
      end)
  """
  @spec with_check(term(), atom(), struct(), (struct() -> {:ok, term()} | {:error, term()})) ::
          {:ok, term()} | {:error, term()}
  def with_check(actor, action, %Comment{} = comment, callback) when is_function(callback, 1) do
    with {:ok, thread} <- FrontDesk.thread_of(comment),
         {:ok, article} <- FrontDesk.article_of(comment, preload: :community),
         %Community{} = community <- article.community do
      Articles.MutationLock.transact_article(community, article, fn ->
        Check.with_authorized(actor, action, {community, thread, article, comment}, callback)
      end)
      |> normalize_decision()
    else
      nil -> {:error, ErrorCat.resource_not_found()}
      {:error, %Decision{} = decision} -> {:error, Decision.primary_error(decision)}
      {:error, reason} -> {:error, reason}
    end
  end

  def with_check(actor, action, %model{} = article, callback)
      when model in [Post, Blog, Changelog, Doc] and is_function(callback, 1) do
    with %Community{} = community <- Repo.get(Community, article.community_id) do
      Articles.MutationLock.transact_article(community, article, fn ->
        Check.with_authorized(actor, action, {community, article}, callback)
      end)
      |> normalize_decision()
    else
      nil -> {:error, ErrorCat.resource_not_found()}
    end
  end

  def with_check(_actor, _action, _resource, _callback),
    do: {:error, ErrorCat.unsupported_resource()}

  defp normalize_decision({:error, %Decision{} = decision}),
    do: {:error, Decision.primary_error(decision)}

  defp normalize_decision(result), do: result
end
