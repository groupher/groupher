defmodule GroupherServer.CMS.SearchArtiments.Indexer do
  @moduledoc """
  Persistent, idempotent Article indexing entrypoints used by background jobs.

  Business position:

      Resolver / Oban
        -> CMS.SearchArtiments
        -> Indexer
        -> search platform
  """

  require GroupherServer.CMS.ErrorCat

  import Ecto.Query, warn: false
  alias GroupherServer.{CMS, Repo}
  alias Helper.T
  alias CMS.{ErrorCat, SearchArtiments}
  alias CMS.Articles.Pagination
  alias CMS.FrontDesk
  alias CMS.SearchArtiments.{Artiment, Config, Projection}
  alias CMS.Model.{Article, ArticleBinding, Community}

  @article_threads Config.article_threads()

  @batch_size 500
  @doc """
  Enqueues a background upsert job for one article.

  The article's thread is resolved through `FrontDesk`, then the indexing
  job is enqueued on the search queue.

  ## Examples

      CMS.SearchArtiments.Indexer.enqueue_upsert(post)

  """
  @spec enqueue_upsert(struct()) :: T.done()
  def enqueue_upsert(article) do
    with {:ok, thread} <- FrontDesk.thread_of(article) do
      enqueue({__MODULE__, :upsert_article, [thread, stable_id(article)]})
    end
  end

  @spec enqueue_metrics(struct()) :: T.done()
  def enqueue_metrics(article) do
    with {:ok, thread} <- FrontDesk.thread_of(article) do
      enqueue({__MODULE__, :sync_article_metrics, [thread, stable_id(article)]})
    end
  end

  @spec enqueue_delete(struct()) :: T.done()
  def enqueue_delete(article) do
    with {:ok, thread} <- FrontDesk.thread_of(article) do
      enqueue_delete(thread, stable_id(article))
    end
  end

  @spec enqueue_delete(Artiment.thread(), Ecto.UUID.t()) :: T.done()
  def enqueue_delete(thread, article_id) do
    enqueue(:delete_article, thread, article_id)
  end

  @doc "Synchronizes one binding's Article search entry after a visibility transition."
  @spec sync_binding(Artiment.thread(), Ecto.UUID.t(), pos_integer()) :: T.done()
  def sync_binding(thread, article_id, community_id) do
    with %Article{thread: ^thread} = article <- Repo.get(Article, article_id),
         %Community{slug: community_slug} <- Repo.get(Community, community_id),
         %ArticleBinding{id: binding_id, inner_id: inner_id} <-
           Repo.get_by(ArticleBinding, article_id: article.id, community_id: community_id) do
      visible_bindings = Pagination.public_binding_ids(thread)

      if Repo.exists?(
           from(binding in ArticleBinding,
             where: binding.id == ^binding_id and binding.id in subquery(visible_bindings)
           )
         ) do
        sync_visible_binding(thread, article, community_slug, inner_id)
      else
        delete_binding(thread, article_id, community_slug)
      end
    else
      _ -> {:error, ErrorCat.search_platform("Article visibility binding not found")}
    end
  end

  @doc "Reloads one Article before projection so jobs never depend on stale structs."
  @spec upsert_article(Artiment.thread(), Ecto.UUID.t()) :: T.done()
  def upsert_article(thread, article_id) do
    case public_article(thread, article_id) do
      {:ok, articles} ->
        articles
        |> Enum.reduce_while({:ok, []}, fn article, {:ok, acc} ->
          case Projection.article(thread, article) do
            {:ok, artiment} -> {:cont, {:ok, [artiment | acc]}}
            {:error, ErrorCat.error_pattern(reason: :not_searchable)} -> {:halt, {:delete, acc}}
            {:error, reason} -> {:halt, {:error, reason}}
          end
        end)
        |> case do
          {:ok, artiments} -> SearchArtiments.upsert(Enum.reverse(artiments))
          {:delete, _artiments} -> delete_article(thread, article_id)
          {:error, reason} -> {:error, reason}
        end

      {:error, :not_found} ->
        delete_article(thread, article_id)
    end
  end

  @spec delete_article(Artiment.thread(), Ecto.UUID.t()) :: T.done()
  def delete_article(thread, article_id) do
    refs =
      ArticleBinding
      |> join(:inner, [binding], community in Community, on: community.id == binding.community_id)
      |> where([binding, _community], binding.article_id == ^article_id)
      |> select([_binding, community], community.slug)
      |> Repo.all()
      |> Enum.map(&Artiment.article_key(thread, article_id, &1))

    SearchArtiments.delete([Artiment.article_key(thread, article_id) | refs])
  end

  defp sync_visible_binding(thread, article, community_slug, inner_id) do
    case FrontDesk.article(%{
           community: community_slug,
           thread: thread,
           inner_id: inner_id
         }) do
      {:ok, public_article} ->
        with {:ok, artiment} <- Projection.article(thread, public_article),
             {:ok, :pass} <- SearchArtiments.upsert([artiment]) do
          {:ok, :pass}
        end

      {:error, ErrorCat.error_pattern(reason: :not_exist)} ->
        delete_binding(thread, public_article_id(article), community_slug)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp delete_binding(thread, article_id, community_slug) do
    SearchArtiments.delete([Artiment.article_key(thread, article_id, community_slug)])
  end

  defp public_article_id(%Article{id: article_id}), do: article_id

  @doc "Reloads and partially updates the mutable ranking metrics of one public Article."
  @spec sync_article_metrics(Artiment.thread(), Ecto.UUID.t()) :: T.done()
  def sync_article_metrics(thread, article_id) do
    case public_article(thread, article_id) do
      {:ok, articles} ->
        metrics =
          Enum.map(articles, fn article ->
            counts = CMS.Interactions.counts([article]) |> Map.get({thread, article.id}, %{})

            {Artiment.article_key(thread, article.id, article.community.slug),
             %{
               upvotes_count: Map.get(counts, :upvotes_count, 0) || 0,
               comments_count: article.comments_count || 0,
               updated_at: article.updated_at
             }}
          end)

        SearchArtiments.update_metrics(metrics)

      {:error, :not_found} ->
        delete_article(thread, article_id)
    end
  end

  @doc "Rebuilds all public Article projections with bounded database batches."
  @spec reindex_articles() :: T.done()
  def reindex_articles do
    Enum.reduce_while(@article_threads, {:ok, :pass}, fn thread, {:ok, :pass} ->
      case reindex_thread(thread, nil) do
        {:ok, :pass} -> {:cont, {:ok, :pass}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp enqueue(action, thread, ref), do: SearchArtiments.queue().enqueue({action, thread, ref})

  defp enqueue({__MODULE__, :upsert_article, [thread, article_id]}) do
    enqueue(:upsert_article, thread, article_id)
  end

  defp enqueue({__MODULE__, :sync_article_metrics, [thread, article_id]}) do
    enqueue(:sync_article_metrics, thread, article_id)
  end

  defp reindex_thread(thread, after_id) do
    case thread in @article_threads do
      true ->
        articles =
          Article
          |> where([article], article.thread == ^thread)
          |> after_article(after_id)
          |> order_by([article], asc: article.id)
          |> limit(^@batch_size)
          |> Repo.all()

        case articles do
          [] ->
            {:ok, :pass}

          roots ->
            with {:ok, public_articles} <- load_public_articles(thread, roots),
                 {:ok, artiments} <- project_batch(thread, public_articles),
                 {:ok, :pass} <- SearchArtiments.upsert(artiments, wait_for_task: true) do
              reindex_thread(thread, List.last(roots).id)
            end
        end

      false ->
        {:error, ErrorCat.invalid_search_artiment("unsupported Article thread")}
    end
  end

  defp project_batch(thread, articles) do
    Enum.reduce_while(articles, {:ok, []}, fn article, {:ok, acc} ->
      case Projection.article(thread, article) do
        {:ok, artiment} -> {:cont, {:ok, [artiment | acc]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, artiments} -> {:ok, Enum.reverse(artiments)}
      {:error, reason} -> {:error, reason}
    end
  end

  defp after_article(query, nil), do: query
  defp after_article(query, article_id), do: where(query, [article], article.id > ^article_id)

  defp load_public_articles(thread, roots) do
    roots
    |> Enum.reduce_while({:ok, []}, fn root, {:ok, batches} ->
      case public_article_for(thread, root) do
        {:ok, articles} -> {:cont, {:ok, [Enum.reverse(articles) | batches]}}
        {:error, :not_found} -> {:cont, {:ok, batches}}
      end
    end)
    |> case do
      {:ok, batches} -> {:ok, batches |> Enum.reverse() |> List.flatten()}
      {:error, reason} -> {:error, reason}
    end
  end

  defp public_article(thread, article_id) do
    case Repo.get(Article, article_id) do
      %Article{thread: ^thread} = article -> public_article_for(thread, article)
      _ -> {:error, :not_found}
    end
  end

  defp public_article_for(thread, %Article{id: article_id, thread: article_thread})
       when article_thread == thread do
    visible_bindings = Pagination.public_binding_ids(thread)

    bindings =
      ArticleBinding
      |> join(:inner, [binding], community in Community, on: community.id == binding.community_id)
      |> where(
        [binding, _community],
        binding.article_id == ^article_id and binding.id in subquery(visible_bindings)
      )
      |> select([binding, community], {binding.inner_id, community.slug})
      |> Repo.all()

    articles =
      Enum.reduce(bindings, [], fn {inner_id, community}, acc ->
        case FrontDesk.article(%{community: community, thread: thread, inner_id: inner_id}) do
          {:ok, public} -> [public | acc]
          {:error, _reason} -> acc
        end
      end)

    if articles == [], do: {:error, :not_found}, else: {:ok, Enum.reverse(articles)}
  end

  defp stable_id(%Article{id: article_id}), do: article_id
  defp stable_id(%{article_id: article_id}) when is_binary(article_id), do: article_id
  defp stable_id(%{id: article_id}) when is_binary(article_id), do: article_id
end
