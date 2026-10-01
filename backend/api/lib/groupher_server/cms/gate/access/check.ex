defmodule GroupherServer.CMS.Gate.Access.Check do
  @moduledoc """
  Runs the complete access check for one supported CMS resource.

  Resource check functions resolve identity, enter the aggregate lock, load
  canonical facts and apply policy. `with_authorized/4` is the lock-internal
  variant used only after `Gate.Access.with_check/4` owns the transaction.

  Business position:

      Gate.Access
        -> Access.Check resource function
        -> resource check: aggregate lock + Access.Load + resource Policy
        -> with_authorized: Access.Load + resource Policy inside an existing lock
        -> Gate.Decision
  """

  require GroupherServer.CMS.Gate.ErrorCat

  alias GroupherServer.{CMS, Repo}

  alias CMS.{Articles, FrontDesk}
  alias CMS.Gate.Access.{Load, Policy}
  alias CMS.Gate.Context.Access.Article, as: ArticleContext
  alias CMS.Gate.Context.Access.Doc, as: DocContext
  alias CMS.Gate.{Decision, Config, ErrorCat}
  alias CMS.Model.{Article, Comment, Community}

  @article_threads Config.article_threads()

  @article_models [Article]

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
             Policy.Community.check_access(actor, action, context.community, context),
             context
           ) do
      {:ok, context.community}
    else
      %Decision{} = decision -> {:error, decision}
      {:error, ErrorCat.error_pattern() = error} -> {:error, Decision.deny(error)}
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
         {:ok, article} <- parent_article(comment),
         %Community{} = community <- Repo.get(Community, article.community_id),
         {:ok, result} <-
           with_parent_lock(community, article, comment.branch_id, fn ->
             with {:ok, context} <- Load.comment(community, thread, article, comment),
                  %Decision{allowed: true} <-
                    Decision.from_result(
                      Policy.Comment.check_access(actor, action, comment, context),
                      context
                    ) do
               {:ok, Map.put(context.comment, :community, context.community)}
             else
               %Decision{} = decision ->
                 {:error, decision}

               {:error, ErrorCat.error_pattern() = error} ->
                 {:error, Decision.deny(error)}
             end
           end) do
      {:ok, result}
    else
      nil -> {:error, Decision.deny(ErrorCat.resource_not_found())}
      {:error, %Decision{} = decision} -> {:error, decision}
      {:error, ErrorCat.error_pattern() = error} -> {:error, Decision.deny(error)}
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
                      Policy.Article.check_access(actor, action, resource, context),
                      context
                    ) do
               {:ok, canonical_resource(context_resource(context), context.community)}
             else
               %Decision{} = decision ->
                 {:error, decision}

               {:error, ErrorCat.error_pattern() = error} ->
                 {:error, Decision.deny(error)}
             end
           end) do
      {:ok, result}
    else
      nil -> {:error, Decision.deny(ErrorCat.resource_not_found())}
      {:error, %Decision{} = decision} -> {:error, decision}
      {:error, ErrorCat.error_pattern() = error} -> {:error, Decision.deny(error)}
    end
  end

  def article(_actor, _action, _resource), do: unsupported_resource()

  @doc "Checks access to one stable Doc Article in an explicit branch."
  @spec doc(term(), atom(), Article.t(), pos_integer()) ::
          {:ok, Article.t()} | {:error, Decision.t()}
  def doc(actor, action, %Article{thread: :doc} = resource, branch_id)
      when is_integer(branch_id) do
    with %Community{} = community <- Repo.get(Community, resource.community_id),
         {:ok, result} <-
           Articles.MutationLock.with_article(community, :doc, branch_id, resource.id, fn ->
             with {:ok, context} <- Load.doc(community, resource, branch_id),
                  %Decision{allowed: true} <-
                    Decision.from_result(
                      Policy.Article.check_access(actor, action, resource, context),
                      context
                    ) do
               {:ok, canonical_resource(context.doc, context.community)}
             else
               %Decision{} = decision -> {:error, decision}
               {:error, ErrorCat.error_pattern() = error} -> {:error, Decision.deny(error)}
             end
           end) do
      {:ok, result}
    else
      nil -> {:error, Decision.deny(ErrorCat.resource_not_found())}
      {:error, %Decision{} = decision} -> {:error, decision}
      {:error, ErrorCat.error_pattern() = error} -> {:error, Decision.deny(error)}
    end
  end

  def doc(_actor, _action, _resource, _branch_id), do: unsupported_resource()

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
           Decision.from_result(
             Policy.Comment.check_access(actor, action, context.comment, context),
             context
           ) do
      decision.context.comment
      |> Map.put(:community, decision.context.community)
      |> callback.()
      |> normalize_callback_result()
    else
      %Decision{} = decision -> {:error, decision}
      {:error, ErrorCat.error_pattern() = error} -> {:error, Decision.deny(error)}
    end
  end

  @spec with_authorized(
          term(),
          atom(),
          tuple(),
          (struct(), struct() -> term())
        ) ::
          {:ok, term()} | {:error, term()}
  def with_authorized(actor, action, {community, thread, article, %Comment{} = comment}, callback)
      when is_function(callback, 2) do
    with {:ok, context} <- Load.comment(community, thread, article, comment),
         %Decision{allowed: true} = decision <-
           Decision.from_result(
             Policy.Comment.check_access(actor, action, context.comment, context),
             context
           ) do
      parent =
        if decision.context.article.thread == :doc do
          Map.put(decision.context.article, :branch_id, decision.context.comment.branch_id)
        else
          decision.context.article
        end

      callback.(decision.context.comment, parent)
      |> normalize_callback_result()
    else
      %Decision{} = decision -> {:error, decision}
      {:error, ErrorCat.error_pattern() = error} -> {:error, Decision.deny(error)}
    end
  end

  def with_authorized(actor, action, {community, article}, callback)
      when is_function(callback, 1) do
    with {:ok, thread} <- article_thread(article),
         {:ok, context} <- Load.article(community, thread, article),
         %Decision{allowed: true} = decision <-
           Decision.from_result(
             Policy.Article.check_access(actor, action, context_resource(context), context),
             context
           ) do
      decision.context
      |> context_resource()
      |> canonical_resource(decision.context.community)
      |> callback.()
      |> normalize_callback_result()
    else
      %Decision{} = decision -> {:error, decision}
      {:error, ErrorCat.error_pattern() = error} -> {:error, Decision.deny(error)}
    end
  end

  @doc "Authorizes one stable Doc Article in an explicit branch inside an existing lock."
  @spec with_authorized_doc(term(), atom(), tuple(), (Article.t() -> term())) ::
          {:ok, term()} | {:error, term()}
  def with_authorized_doc(
        actor,
        action,
        {community, %Article{thread: :doc} = article, branch_id},
        callback
      )
      when is_integer(branch_id) and is_function(callback, 1) do
    with {:ok, context} <- Load.doc(community, article, branch_id),
         %Decision{allowed: true} = decision <-
           Decision.from_result(
             Policy.Article.check_access(actor, action, context_resource(context), context),
             context
           ) do
      decision.context
      |> context_resource()
      |> canonical_resource(decision.context.community)
      |> callback.()
      |> normalize_callback_result()
    else
      %Decision{} = decision -> {:error, decision}
      {:error, ErrorCat.error_pattern() = error} -> {:error, Decision.deny(error)}
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

  defp context_resource(%DocContext{doc: doc, doc_branch_state: state}),
    do: %{doc | comments_locked: state.comments_locked}

  defp article_thread(%{thread: thread}) when thread in @article_threads,
    do: {:ok, thread}

  defp article_thread(resource), do: FrontDesk.thread_of(resource)

  defp parent_article(%Comment{article_id: article_id}) when is_binary(article_id) do
    case Repo.get(Article, article_id) do
      %Article{} = article -> {:ok, article}
      nil -> {:error, ErrorCat.resource_not_found()}
    end
  end

  defp parent_article(comment), do: FrontDesk.article_of(comment, preload: :community)

  defp with_parent_lock(community, %Article{thread: :doc, id: article_id}, branch_id, fun)
       when is_integer(branch_id),
       do: Articles.MutationLock.with_article(community, :doc, branch_id, article_id, fun)

  defp with_parent_lock(community, article, _branch_id, fun),
    do: Articles.MutationLock.with_article(community, article, fun)
end
