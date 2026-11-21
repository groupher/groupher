defmodule GroupherServer.CMS.Outbox.Workflow.Article do
  @moduledoc """
  Dispatches Article effects and delivers independent Search and CDN intents.

  Business position:

      Oban outbox job
        -> Outbox.execute lease + fencing
        -> transactional fanout or isolated projection / Search / CDN delivery
        -> complete / retry / snooze / terminal failure
  """

  alias GroupherServer.{CMS, ErrorCat}

  alias CMS.Outbox
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat

  alias CMS.Model.Article

  @doc """
  Delivers one Article outbox event, updating public projections or purging cache tags.

  Busy leases snooze the job. Retryable errors return to Oban; after the final
  attempt the outbox record is marked failed and the exhausted job completes.
  """
  @spec perform(Oban.Job.t()) :: Oban.Worker.result()
  def perform(%Oban.Job{args: %{"event_id" => event_id}} = job) do
    case Outbox.execute(event_id, &cleanup/1,
           on_error: if(job.attempt >= job.max_attempts, do: :fail, else: :classify)
         ) do
      {:ok, _value} ->
        {:ok, :pass}

      {:busy, seconds} ->
        {:snooze, seconds}

      {:snooze, seconds} ->
        {:snooze, seconds}

      {:error,
       %ErrorCat.Error{
         namespace: {:cms},
         reason: :outbox_delivery_exhausted
       }} ->
        {:ok, :pass}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp cleanup(event) do
    case event.event do
      "article.projections" ->
        run_projections(event)

      "article.first_published_notification" ->
        CMS.Articles.Effects.Publish.deliver_first_publish_notification(event)

      "article.search_sync" ->
        sync_search(event)

      "article.cdn_purge" ->
        purge_cache(event)

      kind
      when kind in [
             "article.published",
             "article.updated",
             "article.visibility_changed",
             "article.review_changed"
           ] ->
        CMS.Articles.Effects.dispatch(event)

      _ ->
        {:error, ArticleErrorCat.unknown_outbox_event()}
    end
  end

  defp sync_search(event) do
    case CMS.Articles.Effects.search_context(event) do
      {:ok, :search_disabled} ->
        {:ok, :search_disabled}

      {:ok,
       %{article: %Article{thread: thread}, source_event: source, community_id: community_id}} ->
        case source do
          kind when kind in ["article.published", "article.updated"] ->
            CMS.SearchArtiments.Indexer.upsert_article(thread, event.resource_id)

          _ ->
            CMS.SearchArtiments.Indexer.sync_binding(thread, event.resource_id, community_id)
        end

      {:error, _reason} = error ->
        error
    end
  end

  defp purge_cache(event) do
    with {:ok, type} <- invalidation_type(event.data["source_event"]),
         {:ok, tags} <- GroupherServer.PublicCache.scope_tags(type, event.data),
         {:ok, _} <- GroupherServer.PublicCache.cloudflare_purge(tags) do
      {:ok, :purged}
    end
  end

  defp run_projections(event) do
    with {:ok, context} <- CMS.Articles.Effects.projection_context(event) do
      CMS.Articles.Effects.run(context)
    end
  end

  defp invalidation_type("article.published"), do: {:ok, :article_published}
  defp invalidation_type("article.updated"), do: {:ok, :article_content_changed}
  defp invalidation_type("article.visibility_changed"), do: {:ok, :article_visibility_changed}
  defp invalidation_type("article.review_changed"), do: {:ok, :article_visibility_changed}
  defp invalidation_type(_event), do: {:error, ArticleErrorCat.unknown_outbox_event()}
end
