defmodule GroupherServer.CMS.Gate.Access.Check do
  @moduledoc """
  Runs the complete access check for one supported CMS resource.

  Resource check functions resolve identity, enter the aggregate lock, load
  canonical facts and apply policy. `with_authorized/4` is the lock-internal
  variant used only after `Gate.Access.with_check/4` owns the transaction.

  Business position:

      Gate.Access
        -> Access.Check resource function
        -> resource check: aggregate lock + Access.Load + Access.Policy
        -> with_authorized: Access.Load + Access.Policy inside an existing lock
        -> Gate.Decision
  """

  alias GroupherServer.CMS.{Articles, FrontDesk}
  alias GroupherServer.CMS.Gate.Access.{Load, Policy}
  alias GroupherServer.CMS.Gate.Config
  alias GroupherServer.CMS.Gate.Context.Access.Article, as: ArticleContext
  alias GroupherServer.CMS.Gate.Context.Access.Doc, as: DocContext
  alias GroupherServer.CMS.Gate.Decision
  alias GroupherServer.CMS.Gate.ErrorCat
  alias GroupherServer.CMS.Model.{Blog, Changelog, Comment, Community, Post}
  alias GroupherServer.CMS.Model.Doc, as: DocModel
  alias GroupherServer.Repo
  @article_threads Config.article_threads()

  @article_models [Post, Blog, Changelog, DocModel]

  @doc """
  Checks access to one Community and returns its canonical loaded value.

  ## Examples

      Check.community(actor, :edit, community)
      #=> {:ok, canonical_community} | {:error, %Gate.Decision{}}
  """
  def community(actor, action, %Community{} = community) do
    with {:ok, context} <- Load.community(community),
         %Decision{allowed: true} <-
           Decision.from_result(
             Policy.community(actor, action, context.community, context),
             context
           ) do
      {:ok, context.community}
    else
      %Decision{} = decision -> {:error, decision}
      {:error, %GroupherServer.ErrorCat.Error{} = error} -> {:error, Decision.deny(error)}
    end
  end

  def community(_actor, _action, _resource), do: unsupported_resource()

  @doc """
  Checks access to one Comment under its Article aggregate lock.

  ## Examples

      Check.comment(actor, :edit, comment)
      #=> {:ok, canonical_comment} | {:error, %Gate.Decision{}}
  """
  def comment(actor, action, %Comment{} = comment) do
    with {:ok, thread} <- FrontDesk.thread_of(comment),
         {:ok, article} <- FrontDesk.article_of(comment, preload: :community),
         %Community{} = community <- article.community,
         {:ok, result} <-
           Articles.MutationLock.with_article(community, article, fn ->
             with {:ok, context} <- Load.comment(community, thread, article, comment),
                  %Decision{allowed: true} <-
                    Decision.from_result(Policy.comment(actor, action, comment, context), context) do
               {:ok, Map.put(context.comment, :community, context.community)}
             else
               %Decision{} = decision ->
                 {:error, decision}

               {:error, %GroupherServer.ErrorCat.Error{} = error} ->
                 {:error, Decision.deny(error)}
             end
           end) do
      {:ok, result}
    else
      nil -> {:error, Decision.deny(ErrorCat.resource_not_found())}
      {:error, %Decision{} = decision} -> {:error, decision}
      {:error, %GroupherServer.ErrorCat.Error{} = error} -> {:error, Decision.deny(error)}
    end
  end

  def comment(_actor, _action, _resource), do: unsupported_resource()

  @doc """
  Checks access to one Article under its aggregate lock.

  ## Examples

      Check.article(actor, :edit, post)
      #=> {:ok, canonical_post} | {:error, %Gate.Decision{}}
  """
  def article(actor, action, %model{} = resource) when model in @article_models do
    with %Community{} = community <- Repo.get(Community, resource.community_id),
         {:ok, thread} <- article_thread(resource),
         {:ok, result} <-
           Articles.MutationLock.with_article(community, resource, fn ->
             with {:ok, context} <- Load.article(community, thread, resource),
                  %Decision{allowed: true} <-
                    Decision.from_result(
                      Policy.article(actor, action, resource, context),
                      context
                    ) do
               {:ok, canonical_resource(context_resource(context), context.community)}
             else
               %Decision{} = decision ->
                 {:error, decision}

               {:error, %GroupherServer.ErrorCat.Error{} = error} ->
                 {:error, Decision.deny(error)}
             end
           end) do
      {:ok, result}
    else
      nil -> {:error, Decision.deny(ErrorCat.resource_not_found())}
      {:error, %Decision{} = decision} -> {:error, decision}
      {:error, %GroupherServer.ErrorCat.Error{} = error} -> {:error, Decision.deny(error)}
    end
  end

  def article(_actor, _action, _resource), do: unsupported_resource()

  @doc """
  Loads, authorizes and invokes a callback after the caller has acquired the
  aggregate transaction and advisory lock.

  This is the lock-internal primitive used by `Gate.Access.with_check/4`.
  Rejections return `{:error, %Gate.Decision{}}`; callback results are limited
  to `{:ok, result}` or `{:error, reason}`.

  ## Examples

      Check.with_authorized(actor, :edit, {community, post}, fn canonical ->
        ORM.update(canonical, attrs)
      end)
  """
  @spec with_authorized(term(), atom(), tuple(), (struct() -> term())) ::
          {:ok, term()} | {:error, term()}
  def with_authorized(actor, action, {community, thread, article, %Comment{} = comment}, callback)
      when is_function(callback, 1) do
    with {:ok, context} <- Load.comment(community, thread, article, comment),
         %Decision{allowed: true} = decision <-
           Decision.from_result(Policy.comment(actor, action, context.comment, context), context) do
      decision.context.comment
      |> Map.put(:community, decision.context.community)
      |> callback.()
      |> normalize_callback_result()
    else
      %Decision{} = decision -> {:error, decision}
      {:error, %GroupherServer.ErrorCat.Error{} = error} -> {:error, Decision.deny(error)}
    end
  end

  def with_authorized(actor, action, {community, article}, callback)
      when is_function(callback, 1) do
    with {:ok, thread} <- article_thread(article),
         {:ok, context} <- Load.article(community, thread, article),
         %Decision{allowed: true} = decision <-
           Decision.from_result(Policy.article(actor, action, article, context), context) do
      decision.context
      |> context_resource()
      |> canonical_resource(decision.context.community)
      |> callback.()
      |> normalize_callback_result()
    else
      %Decision{} = decision -> {:error, decision}
      {:error, %GroupherServer.ErrorCat.Error{} = error} -> {:error, Decision.deny(error)}
    end
  end

  defp normalize_callback_result({:ok, _result} = result), do: result
  defp normalize_callback_result({:error, _reason} = result), do: result

  defp normalize_callback_result(result) do
    {:error, ErrorCat.unexpected_callback_result(callback_result_kind(result))}
  end

  defp callback_result_kind(result) when is_tuple(result),
    do: %{result_kind: :tuple, tuple_arity: tuple_size(result)}

  defp callback_result_kind(result) when is_atom(result), do: %{result_kind: :atom}
  defp callback_result_kind(result) when is_map(result), do: %{result_kind: :map}
  defp callback_result_kind(result) when is_list(result), do: %{result_kind: :list}
  defp callback_result_kind(result) when is_binary(result), do: %{result_kind: :binary}
  defp callback_result_kind(result) when is_number(result), do: %{result_kind: :number}
  defp callback_result_kind(_result), do: %{result_kind: :other}

  defp unsupported_resource,
    do: {:error, Decision.deny(ErrorCat.unsupported_resource())}

  defp canonical_resource(resource, community), do: Map.put(resource, :community, community)
  defp context_resource(%ArticleContext{article: article}), do: article
  defp context_resource(%DocContext{doc: doc}), do: doc

  defp article_thread(%{thread: thread}) when thread in @article_threads,
    do: {:ok, thread}

  defp article_thread(resource), do: FrontDesk.thread_of(resource)
end
