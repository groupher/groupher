defmodule GroupherServer.CMS.SearchArtiments.Indexer do
  @moduledoc """
  Persistent, idempotent Article indexing entrypoints used by background jobs.

  Business position:

      Resolver / Oban
        -> CMS.SearchArtiments
        -> Indexer
        -> search platform
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.Matcher

  alias GroupherServer.{CMS, Repo}
  alias CMS.Gate.Context.Scope.Article, as: ArticleScope
  alias CMS.Gate.Context.Scope.Doc, as: DocScope
  alias CMS.SearchArtiments
  alias CMS.SearchArtiments.{Artiment, Projection}
  alias Helper.Constant

  require CMS.Const

  @batch_size 500
  @legal Constant.CMS.pending(:legal)

  @doc """
  Enqueues a background upsert job for one article.

  The article's thread is resolved through `CMS.FrontDesk`, then the indexing
  job is enqueued on the search queue.

  ## Examples

      CMS.SearchArtiments.Indexer.enqueue_upsert(post)

  """
  @spec enqueue_upsert(struct()) :: {:ok, :pass} | {:error, term()}
  def enqueue_upsert(article) do
    with {:ok, thread} <- CMS.FrontDesk.thread_of(article) do
      enqueue({__MODULE__, :upsert_article, [thread, article.id]})
    end
  end

  @spec enqueue_metrics(struct()) :: {:ok, :pass} | {:error, term()}
  def enqueue_metrics(article) do
    with {:ok, thread} <- CMS.FrontDesk.thread_of(article) do
      enqueue({__MODULE__, :sync_article_metrics, [thread, article.id]})
    end
  end

  @spec enqueue_delete(struct()) :: {:ok, :pass} | {:error, term()}
  def enqueue_delete(article) do
    with {:ok, thread} <- CMS.FrontDesk.thread_of(article) do
      enqueue_delete(thread, article.article_hash_id)
    end
  end

  @spec enqueue_delete(Artiment.thread(), Ecto.UUID.t()) :: {:ok, :pass}
  def enqueue_delete(thread, article_hash_id) do
    enqueue(:delete_article, thread, article_hash_id)
  end

  @doc "Reloads one Article before projection so jobs never depend on stale structs."
  @spec upsert_article(Artiment.thread(), pos_integer()) :: :ok | {:error, term()}
  def upsert_article(thread, article_id) do
    with {:ok, info} <- match(thread),
         article when not is_nil(article) <-
           info.model
           |> CMS.Gate.scope(nil, :read, scope_context(thread))
           |> where([article], article.id == ^article_id)
           |> Repo.one() do
      case Projection.Article.project(thread, article) do
        {:ok, artiment} ->
          SearchArtiments.upsert([artiment])

        {:error, %GroupherServer.ErrorCat.Error{reason: :not_searchable}} ->
          delete_article(thread, article.article_hash_id)

        error ->
          error
      end
    else
      nil -> :ok
      error -> error
    end
  end

  @spec delete_article(Artiment.thread(), Ecto.UUID.t()) :: :ok | {:error, term()}
  def delete_article(thread, article_hash_id) do
    SearchArtiments.delete([Artiment.article_ref(thread, article_hash_id)])
  end

  @doc "Reloads and partially updates the mutable ranking metrics of one public Article."
  @spec sync_article_metrics(Artiment.thread(), pos_integer()) :: :ok | {:error, term()}
  def sync_article_metrics(thread, article_id) do
    with {:ok, info} <- match(thread),
         article when not is_nil(article) <- searchable_article(info.model, thread, article_id) do
      counts = CMS.Interactions.counts([article]) |> Map.get({thread, article.id}, %{})

      SearchArtiments.update_metrics([
        {Artiment.article_ref(thread, article.article_hash_id),
         %{
           upvotes_count: Map.get(counts, :upvotes_count, 0) || 0,
           comments_count: article.comments_count || 0,
           updated_at: article.updated_at
         }}
      ])
    else
      nil -> :ok
      error -> error
    end
  end

  @doc "Rebuilds all public Article projections with bounded database batches."
  @spec reindex_articles() :: :ok | {:error, term()}
  def reindex_articles do
    Enum.reduce_while([:post, :blog, :changelog, :doc], :ok, fn thread, :ok ->
      case reindex_thread(thread, 0) do
        :ok -> {:cont, :ok}
        error -> {:halt, error}
      end
    end)
  end

  defp searchable_article(model, thread, article_id) do
    model
    |> CMS.Gate.scope(nil, :read, scope_context(thread))
    |> where([article], article.id == ^article_id)
    |> where([article], article.stage == ^CMS.Const.stage(:public))
    |> where([article], article.pending == ^@legal)
    |> Repo.one()
  end

  defp enqueue(action, thread, ref), do: SearchArtiments.queue().enqueue({action, thread, ref})

  defp enqueue({__MODULE__, :upsert_article, [thread, article_id]}) do
    enqueue(:upsert_article, thread, article_id)
  end

  defp enqueue({__MODULE__, :sync_article_metrics, [thread, article_id]}) do
    enqueue(:sync_article_metrics, thread, article_id)
  end

  defp reindex_thread(thread, after_id) do
    with {:ok, info} <- match(thread) do
      articles =
        info.model
        |> CMS.Gate.scope(nil, :list, scope_context(thread))
        |> where([article], article.id > ^after_id)
        |> where([article], article.stage == ^CMS.Const.stage(:public))
        |> where([article], article.pending == ^@legal)
        |> order_by([article], asc: article.id)
        |> limit(^@batch_size)
        |> Repo.all()

      case articles do
        [] ->
          :ok

        articles ->
          with {:ok, artiments} <- project_batch(thread, articles),
               :ok <- SearchArtiments.upsert(artiments, wait_for_task: true) do
            reindex_thread(thread, List.last(articles).id)
          end
      end
    end
  end

  defp project_batch(thread, articles) do
    Enum.reduce_while(articles, {:ok, []}, fn article, {:ok, acc} ->
      case Projection.Article.project(thread, article) do
        {:ok, artiment} -> {:cont, {:ok, [artiment | acc]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, artiments} -> {:ok, Enum.reverse(artiments)}
      error -> error
    end
  end

  defp scope_context(:doc), do: DocScope.public_main()
  defp scope_context(thread), do: ArticleScope.public(thread)
end
