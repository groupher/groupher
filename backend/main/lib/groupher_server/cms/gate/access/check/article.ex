defmodule GroupherServer.CMS.Gate.Access.Check.Article do
  @moduledoc """
  Executes Article and Doc single-resource access checks.

  The selected article thread determines the Loader context and the parent
  Article lock. The policy remains in `Access.Article`; this module owns only
  access-check orchestration and canonical resource assembly.

      Article / Doc
        -> Repo community lookup
        -> FrontDesk thread resolution
        -> Articles.Lock.run_for_article
        -> Loader.Article
        -> Access.Article policy
        -> Decision
        -> canonical resource or denial
  """

  alias GroupherServer.CMS.Gate.Access.Article, as: ArticlePolicy
  alias GroupherServer.CMS.Gate.Access.Loader
  alias GroupherServer.CMS.Gate.Context.Access.{Article, Doc}
  alias GroupherServer.CMS.Gate.Decision
  alias GroupherServer.CMS.Model.Community
  alias GroupherServer.CMS.{Articles, FrontDesk}
  alias GroupherServer.Repo

  @doc false
  @spec run(term(), atom(), map()) ::
          {:ok, map()} | {:error, Decision.t()}
  def run(actor, action, %{community_id: community_id} = resource) do
    with %Community{} = community <- Repo.get(Community, community_id),
         {:ok, thread} <- article_thread(resource),
         {:ok, result} <-
           Articles.Lock.run_for_article(community, thread, resource, fn ->
             with {:ok, context} <- Loader.article(community, thread, resource),
                  %Decision{allowed: true} <- decision(actor, action, resource, context) do
               {:ok, canonical_resource(context_resource(context), context.community)}
             else
               %Decision{} = decision -> {:error, decision}
               {:error, reason} -> {:error, Decision.deny(reason)}
             end
           end) do
      {:ok, result}
    else
      nil -> {:error, Decision.deny(:resource_not_found)}
      {:error, %Decision{} = decision} -> {:error, decision}
      {:error, reason} -> {:error, Decision.deny(reason)}
    end
  end

  defp decision(actor, action, resource, context),
    do:
      Decision.from_result(ArticlePolicy.check_access(actor, action, resource, context), context)

  defp canonical_resource(resource, community), do: Map.put(resource, :community, community)

  defp context_resource(%Article{article: article}), do: article
  defp context_resource(%Doc{doc: doc}), do: doc

  defp article_thread(%{thread: thread}) when thread in [:post, :blog, :changelog, :doc],
    do: {:ok, thread}

  defp article_thread(resource), do: FrontDesk.thread_of(resource)
end
