defmodule GroupherServer.CMS.Outbox.Workflow.Article do
  @moduledoc """
  Delivers Article public-cache cleanup intents after the Article transaction.

  Business position:

      Oban outbox job
        -> Outbox.execute lease + fencing
        -> Article projection effect or cache purge
        -> complete / retry / snooze / terminal failure
  """

  alias GroupherServer.{CMS, ErrorCat, Repo}

  alias CMS.Outbox
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticlePublic,
    ArticleRevision,
    Community,
    DocBranch,
    DocBranchVersion,
    DocPublic
  }

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
      "article.projections" -> run_projections(event)
      "article.visibility_changed" -> sync_visibility(event)
      _ -> purge_cache(event)
    end
  end

  defp sync_visibility(event) do
    with %Article{thread: thread} <- Repo.get(Article, event.resource_id),
         community_id when is_integer(community_id) <- Map.get(event.data, "community_id"),
         {:ok, :pass} <-
           CMS.SearchArtiments.Indexer.sync_binding(thread, event.resource_id, community_id),
         {:ok, _} <- purge_cache(event) do
      {:ok, :pass}
    else
      nil -> {:error, ArticleErrorCat.projection_not_found()}
      {:error, _reason} = error -> error
      _ -> {:error, ArticleErrorCat.projection_not_found()}
    end
  end

  defp purge_cache(event) do
    with {:ok, type} <- invalidation_type(event.event),
         {:ok, tags} <- GroupherServer.PublicCache.scope_tags(type, event.data),
         {:ok, _} <- GroupherServer.PublicCache.cloudflare_purge(tags) do
      {:ok, :purged}
    end
  end

  defp run_projections(event) do
    with %Article{} = article <- Repo.get(Article, event.resource_id),
         community_id when is_integer(community_id) <- Map.get(event.data, "community_id"),
         %Community{} = community <- Repo.get(Community, community_id),
         %ArticleBinding{} = binding <-
           Repo.get_by(ArticleBinding, article_id: article.id, community_id: community.id) do
      projection_result(event, article, community, binding)
    else
      nil -> {:error, ArticleErrorCat.projection_not_found()}
    end
  end

  defp projection_result(event, %Article{thread: :doc} = article, community, binding) do
    branch_id = Map.get(event.data, "branch_id")

    with %DocBranch{} = branch <- Repo.get(DocBranch, branch_id),
         %DocPublic{} = public <-
           Repo.get_by(DocPublic, article_id: article.id, branch_id: branch.id),
         %DocBranchVersion{} = version <- Repo.get(DocBranchVersion, public.branch_version_id),
         %ArticleRevision{} = revision <- Repo.get(ArticleRevision, version.revision_id) do
      CMS.Articles.Effects.run(
        projection_payload(event, article, community, binding, public, revision)
        |> Map.put(:branch_type, branch.type)
        |> Map.put(:version, version)
      )
    else
      nil -> {:error, ArticleErrorCat.projection_not_found()}
    end
  end

  defp projection_result(event, %Article{} = article, community, binding) do
    with %ArticlePublic{} = public <- Repo.get(ArticlePublic, article.id),
         %ArticleRevision{} = revision <- Repo.get(ArticleRevision, public.revision_id) do
      CMS.Articles.Effects.run(
        projection_payload(event, article, community, binding, public, revision)
      )
    else
      nil -> {:error, ArticleErrorCat.projection_not_found()}
    end
  end

  defp projection_payload(event, article, community, binding, public, revision) do
    %{
      article: article,
      community: community,
      binding: binding,
      public: public,
      revision: revision,
      first_publish?: Map.get(event.data, "first_publish?", false),
      changed_fields: changed_fields(Map.get(event.data, "changed_fields", [])),
      published_by_id: Map.get(event.data, "published_by_id")
    }
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
  defp invalidation_type("article.review_changed"), do: {:ok, :article_visibility_changed}
  defp invalidation_type(_event), do: {:error, ArticleErrorCat.unknown_outbox_event()}
end
