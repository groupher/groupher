defmodule GroupherServer.CMS.Gate.Access.Check do
  @moduledoc """
  Runs the complete access check for one supported CMS resource.

  Resource check functions resolve identity, enter the aggregate lock, load
  canonical facts and apply policy. `with_authorized/4` is the lock-internal
  variant used only after `CMS.Gate.with_check/4` owns the transaction.

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
    with {:ok, context} <- Load.community(actor, community),
         %Decision{allowed: true} <-
           Decision.from_result(
             Policy.community(actor, action, context.community, context),
             context
           ) do
      {:ok, context.community}
    else
      %Decision{} = decision -> {:error, decision}
      {:error, ErrorCat.error_pattern() = error} -> {:error, Decision.deny(error)}
    end
  end

  def community(_actor, _action, _resource), do: unsupported_resource()

  @doc "Checks Community preview admission inside a read-only repeatable-read transaction."
  def community_snapshot(actor, action, %Community{} = community)
      when action in [
             :docs_queue_preview,
             :docs_history_read,
             :docs_queue_configure,
             :community_article_trash_read
           ] do
    with {:ok, :pass} <- snapshot_transaction(),
         {:ok, context} <- Load.community_snapshot(actor, community),
         %Decision{allowed: true} <-
           Decision.from_result(
             Policy.community(actor, action, context.community, context),
             context
           ) do
      {:ok, context.community}
    else
      %Decision{} = decision -> {:error, decision}
      {:error, ErrorCat.error_pattern() = error} -> {:error, Decision.deny(error)}
      {:error, _} = error -> error
    end
  end

  def community_snapshot(_, _, _), do: unsupported_resource()

  @doc "Checks a Doc's read or edit policy using facts from the caller's read-only snapshot."
  def doc_snapshot(actor, action, %Community{} = community, %Article{thread: :doc} = article)
      when action in [:read, :edit] do
    with {:ok, :pass} <- snapshot_transaction(),
         {:ok, context} <- Load.doc_site_snapshot(actor, community, article),
         %Decision{allowed: true} = decision <-
           Decision.from_result(Policy.article(actor, action, context), context) do
      {:ok, canonical_resource(context_resource(decision.context), decision.context.community)}
    else
      %Decision{} = decision -> {:error, decision}
      {:error, ErrorCat.error_pattern() = error} -> {:error, Decision.deny(error)}
      {:error, _} = error -> error
    end
  end

  def doc_snapshot(_, _, _, _), do: unsupported_resource()

  defp snapshot_transaction do
    if Repo.in_transaction?() do
      case Repo.query(
             "SELECT current_setting('transaction_read_only'), current_setting('transaction_isolation')"
           ) do
        {:ok, %{rows: [["on", "repeatable read"]]}} -> {:ok, :pass}
        {:ok, _} -> {:error, ErrorCat.gate_transaction_required()}
        {:error, _} = error -> error
      end
    else
      {:error, ErrorCat.gate_transaction_required()}
    end
  end

  @doc "Authorizes a Community and invokes a callback inside its existing row lock."
  @spec with_authorized_community(term(), atom(), Community.t(), (Community.t() -> term())) ::
          {:ok, term()} | {:error, term()}
  def with_authorized_community(actor, action, %Community{} = community, callback)
      when is_function(callback, 1) do
    with {:ok, context} <- Load.community(actor, community),
         %Decision{allowed: true} = decision <-
           Decision.from_result(
             Policy.community(actor, action, context.community, context),
             context
           ) do
      decision.context.community
      |> callback.()
      |> normalize_callback_result()
    else
      %Decision{} = decision -> {:error, decision}
      {:error, ErrorCat.error_pattern() = error} -> {:error, Decision.deny(error)}
    end
  end

  @doc """
  Checks access to one Comment under its Article aggregate lock.

  ## Examples

      Check.comment(actor, :edit, comment)
      #=> {:ok, canonical_comment} | {:error, %Gate.Decision{}}
  """
  def comment(actor, action, %Comment{} = comment) do
    with {:ok, thread} <- FrontDesk.thread_of(comment),
         {:ok, article} <- parent_article(comment),
         {:ok, %Community{} = community} <- CMS.Comments.RequestCommunity.resolve(comment),
         {:ok, result} <-
           with_parent_lock(community, article, fn ->
             with {:ok, context} <- Load.comment(actor, community, thread, article, comment),
                  %Decision{allowed: true} <-
                    Decision.from_result(
                      Policy.comment(actor, action, context),
                      context
                    ) do
               {:ok,
                context.comment
                |> Map.put(:community, context.community)
                |> Map.put(:request_community_slug, context.community.slug)}
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
  def article(actor, :manage_coauthors, %Article{} = resource) do
    with {:ok, context} <- Load.article_author_management(actor, resource),
         %Decision{allowed: true} = decision <-
           Decision.from_result(Policy.article(actor, :manage_coauthors, context), context) do
      {:ok, decision.context.article}
    else
      %Decision{} = decision -> {:error, decision}
      {:error, ErrorCat.error_pattern() = error} -> {:error, Decision.deny(error)}
    end
  end

  def article(actor, action, %model{} = resource) when model in @article_models do
    _ = {actor, action, resource}
    {:error, Decision.deny(ErrorCat.resource_not_found())}
  end

  def article(_actor, _action, _resource), do: unsupported_resource()

  @doc "Checks access to an Article under an explicit Community binding context."
  def article(actor, action, %Article{} = resource, %Community{} = community) do
    article_with_community(actor, action, resource, community)
  end

  defp article_with_community(actor, action, %Article{} = resource, %Community{} = community) do
    with {:ok, thread} <- article_thread(resource) do
      Articles.MutationLock.with_article(community, resource, fn ->
        with {:ok, context} <- Load.article(actor, community, thread, resource),
             {:ok, context} <- Articles.EditingPolicy.load(context, action),
             %Decision{allowed: true} <-
               Decision.from_result(
                 Policy.article(actor, action, context),
                 context
               ) do
          {:ok, canonical_resource(context_resource(context), context.community)}
        else
          %Decision{} = decision ->
            {:error, decision}

          {:error, ErrorCat.error_pattern() = error} ->
            {:error, Decision.deny(error)}
        end
      end)
    end
  end

  @doc """
  Loads, authorizes and invokes a callback after the caller has acquired the
  aggregate transaction and advisory lock.

  This is the lock-internal primitive used by `CMS.Gate.with_check/4`.
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
    with {:ok, context} <- Load.comment(actor, community, thread, article, comment),
         %Decision{allowed: true} = decision <-
           Decision.from_result(
             Policy.comment(actor, action, context),
             context
           ) do
      decision.context.comment
      |> Map.put(:community, decision.context.community)
      |> Map.put(:request_community_slug, decision.context.community.slug)
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
    with {:ok, context} <- Load.comment(actor, community, thread, article, comment),
         %Decision{allowed: true} = decision <-
           Decision.from_result(
             Policy.comment(actor, action, context),
             context
           ) do
      parent = canonical_resource(decision.context.article, decision.context.community)

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
         {:ok, context} <- Load.article(actor, community, thread, article),
         {:ok, context} <- Articles.EditingPolicy.load(context, action),
         %Decision{allowed: true} = decision <-
           Decision.from_result(
             Policy.article(actor, action, context),
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

  @doc "Authorizes an ordinary Article operation against an explicit ArticleBinding binding."
  @spec with_authorized_article_binding(term(), atom(), tuple(), (Article.t() -> term())) ::
          {:ok, term()} | {:error, term()}
  def with_authorized_article_binding(actor, action, {community, article}, callback)
      when is_function(callback, 1) do
    with {:ok, thread} <- article_thread(article),
         {:ok, context} <- Load.article_in_community(actor, community, thread, article),
         {:ok, context} <- Articles.EditingPolicy.load(context, action),
         %Decision{allowed: true} = decision <-
           Decision.from_result(
             Policy.article(actor, action, context),
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

  defp callback_result_kind(result) when is_tuple(result) do
    %{result_kind: :tuple, tuple_arity: tuple_size(result)}
  end

  defp callback_result_kind(result) when is_atom(result), do: %{result_kind: :atom}
  defp callback_result_kind(result) when is_map(result), do: %{result_kind: :map}
  defp callback_result_kind(result) when is_list(result), do: %{result_kind: :list}
  defp callback_result_kind(result) when is_binary(result), do: %{result_kind: :binary}
  defp callback_result_kind(result) when is_number(result), do: %{result_kind: :number}
  defp callback_result_kind(_result), do: %{result_kind: :other}

  defp unsupported_resource do
    {:error, Decision.deny(ErrorCat.unsupported_resource())}
  end

  defp canonical_resource(resource, community), do: Map.put(resource, :community, community)
  defp context_resource(%ArticleContext{article: article}), do: article

  defp context_resource(%DocContext{doc: doc}), do: doc

  defp article_thread(%{thread: thread}) when thread in @article_threads do
    {:ok, thread}
  end

  defp article_thread(resource), do: FrontDesk.thread_of(resource)

  defp parent_article(%Comment{article_id: article_id}) when is_binary(article_id) do
    case Repo.get(Article, article_id) do
      %Article{} = article -> {:ok, article}
      nil -> {:error, ErrorCat.resource_not_found()}
    end
  end

  defp parent_article(_comment), do: {:error, ErrorCat.resource_not_found()}

  defp with_parent_lock(community, article, fun) do
    Articles.MutationLock.with_article(community, article, fun)
  end
end
