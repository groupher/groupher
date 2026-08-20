defmodule GroupherServer.CMS.Gate.Access.Check do
  @moduledoc """
  Runs the complete access check for one supported CMS resource.

  Each function is named after the resource being checked. It resolves the
  resource identity, enters the aggregate lock, loads canonical facts, applies
  the resource policy, and returns a Gate Decision.

  Business position:

      Gate.Access
        -> Access.Check resource function
        -> aggregate lock + Access.Load + Access.Policy
        -> Gate.Decision
  """

  alias GroupherServer.CMS
  alias CMS.Gate
  alias Gate.Access.{Load, Policy}
  alias Gate.Context.Access.Article, as: ArticleContext
  alias Gate.Context.Access.Doc, as: DocContext
  alias Gate.Decision
  alias Gate.ErrorCat
  alias CMS.Model.{Blog, Changelog, Comment, Community, Post}
  alias CMS.Model.Doc, as: DocModel
  alias CMS.{Articles, FrontDesk}
  alias GroupherServer.Repo

  @article_models [Post, Blog, Changelog, DocModel]

  @doc false
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

  @doc false
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

  @doc false
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

  defp unsupported_resource,
    do: {:error, Decision.deny(ErrorCat.unsupported_resource())}

  defp canonical_resource(resource, community), do: Map.put(resource, :community, community)
  defp context_resource(%ArticleContext{article: article}), do: article
  defp context_resource(%DocContext{doc: doc}), do: doc

  defp article_thread(%{thread: thread}) when thread in [:post, :blog, :changelog, :doc],
    do: {:ok, thread}

  defp article_thread(resource), do: FrontDesk.thread_of(resource)
end
