defmodule GroupherServerWeb.Resolvers.ArticleStatsPayload do
  @moduledoc """
  Loads and presents the committed public ArticleStats row for mutation payloads.

      domain mutation result
        -> FrontDesk batch projection reader
        -> ArticleStatsPayload
        -> GraphQL mutation payload

  The module does not perform Gate admission, business writes, transactions, or
  command recovery. Those remain owned by the calling operation.
  """

  alias GroupherServer.CMS
  alias CMS.ErrorCat, as: CmsErrorCat

  @doc """
  Loads the committed public projection for one mutation result.

  The read happens after the domain transaction and reuses the Gate-aware batch
  reader. Missing projection rows return `command_result_unavailable`; callers
  must not synthesize zero counts or reconstruct the write locally.
  """
  def load(thread, article, community) do
    case CMS.FrontDesk.article_stats_for_articles(thread, [article], community) do
      stats when is_map(stats) -> from_map(stats, thread, article, community)
      {:error, _reason} = error -> error
      _ -> unavailable()
    end
  end

  @doc """
  Extracts one ArticleStats row from a batch result and adds its public locator.

  This mapper performs no database read. It preserves the revision and snapshot
  observed by the batch reader, which may differ from a separately read private
  InteractionState under concurrent writes.
  """
  def from_map(stats, thread, article, community) do
    case Map.fetch(stats, {thread, article.id}) do
      {:ok, article_stats} ->
        {:ok,
         Map.merge(article_stats, %{
           community: community,
           thread: thread,
           inner_id: article.inner_id
         })}

      :error ->
        unavailable()
    end
  end

  defp unavailable, do: {:error, CmsErrorCat.command_result_unavailable()}
end
