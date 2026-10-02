defmodule GroupherServer.CMS.Outbox.Workers.Article.Cleanup do
  @moduledoc """
  Delivers Article public-cache cleanup intents after the Article transaction.

  Business position:

      committed Article outbox event
        -> Article.Cleanup worker
        -> projection effect or public-cache purge
  """

  use Oban.Worker,
    queue: :cms_outbox,
    max_attempts: 8,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  alias GroupherServer.CMS.Outbox
  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.PublicCache.{Cloudflare, Scope}
  alias CMS.Articles.Publish.Effects
  alias CMS.Model.{Article, ArticlePublic, ArticleRevision}

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"event_id" => event_id}} = job) do
    case Outbox.execute(event_id, &cleanup/1) do
      {:ok, _value} -> :ok
      {:busy, seconds} -> {:snooze, seconds}
      {:error, _reason} when job.attempt >= job.max_attempts ->
        _ = Outbox.mark_dead(event_id)
        :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp cleanup(event) do
    case event.event do
      "article.projections" -> run_projections(event)
      _ -> purge_cache(event)
    end
  end

  defp purge_cache(event) do
    with {:ok, type} <- invalidation_type(event.event),
         {:ok, tags} <- Scope.tags(type, event.data),
         :ok <- Cloudflare.purge(tags) do
      {:ok, :purged}
    end
  end

  defp run_projections(event) do
    with %Article{} = article <- Repo.get(Article, event.resource_id),
         %ArticlePublic{} = public <- Repo.get(ArticlePublic, article.id),
         %ArticleRevision{} = revision <- Repo.get(ArticleRevision, public.revision_id) do
      Effects.run(%{
        article: article,
        public: public,
        revision: revision,
        first_publish?: Map.get(event.data, "first_publish?", false),
        changed_fields: changed_fields(Map.get(event.data, "changed_fields", [])),
        published_by_id: Map.get(event.data, "published_by_id")
      })
    else
      nil -> {:error, :article_projection_not_found}
    end
  end

  defp changed_fields(fields) when is_list(fields) do
    Enum.map(fields, fn
      "title" -> :title
      "body_hash" -> :body_hash
      "cover_edit" -> :cover_edit
      value -> value
    end)
  end

  defp changed_fields(_fields), do: []

  defp invalidation_type("article.published"), do: {:ok, :article_published}
  defp invalidation_type("article.updated"), do: {:ok, :article_content_changed}
  defp invalidation_type("article.visibility_changed"), do: {:ok, :article_visibility_changed}
  defp invalidation_type(_event), do: {:error, :unknown_article_outbox_event}
end
