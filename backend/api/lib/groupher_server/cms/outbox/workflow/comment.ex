defmodule GroupherServer.CMS.Outbox.Workflow.Comment do
  @moduledoc """
  Delivers public cache cleanup intents created by Comment writes.

  Business position:

      Oban outbox job
        -> Outbox.execute lease + fencing
        -> Comment Effects / projection delivery
        -> complete / retry / snooze / terminal failure
  """

  alias GroupherServer.{CMS, ErrorCat, Jobs, Repo}
  alias CMS.Outbox
  alias CMS.Comments.ErrorCat, as: CommentErrorCat
  alias CMS.Model.Article
  alias CMS.SearchArtiments.Indexer

  @doc """
  Delivers one Comment outbox event under the shared lease and retry protocol.

  Busy leases snooze; transient delivery errors retry; after exhaustion Outbox
  records terminal failure and the job is acknowledged.
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
      "comment.changed" ->
        with {:ok, _} <- purge_comment_cache(event),
             {:ok, _} <- purge_ticket_cache(event.data),
             {:ok, _} <- sync_summary_metrics(event) do
          {:ok, :purged}
        end

      "comment.deleted" ->
        with {:ok, %{article: article}} <- CMS.Comments.Effects.delivery_context(event),
             {:ok, _} <- normalize(Indexer.enqueue_metrics(article)) do
          {:ok, :effects_enqueued}
        end

      action when action in ["comment.updated", "comment.replied"] ->
        # Required cache, mention and review effects have their own intents.
        # This acknowledged intent must not depend on a Community still existing.
        {:ok, :effects_not_required}

      action ->
        comment_effects(action, event)
    end
  end

  defp comment_effects(action, event)
       when action == "comment.created" do
    with {:ok, context} <- CMS.Comments.Effects.delivery_context(event) do
      case context.community do
        nil ->
          {:ok, :community_gone}

        community ->
          with {:ok, _} <- enqueue_comment_job(action, context.comment, context.actor, community) do
            {:ok, :effects_enqueued}
          end
      end
    end
  end

  defp comment_effects(_action, _event), do: {:error, CommentErrorCat.unknown_outbox_event()}

  defp enqueue_comment_job("comment.created", _comment, actor, community) do
    with {:ok, _} <-
           enqueue(:subscribe_community, community.id, fn ->
             Jobs.subscribe_community(community, actor)
           end) do
      {:ok, :pass}
    end
  end

  defp enqueue(type, key, fun), do: Jobs.enqueue_best_effort(type, key, fun)

  defp purge_comment_cache(event) do
    with {:ok, tags} <-
           GroupherServer.PublicCache.scope_tags(:comments_content_changed, event.data),
         {:ok, result} <- GroupherServer.PublicCache.cloudflare_purge(tags) do
      {:ok, result}
    end
  end

  defp sync_summary_metrics(%{data: %{"count_changed" => true}, resource_id: id}) do
    case Repo.get(Article, id) do
      %Article{} = article -> normalize(Indexer.enqueue_metrics(article))
      nil -> {:ok, :owner_deleted}
    end
  end

  defp sync_summary_metrics(_event), do: {:ok, :pass}

  defp purge_ticket_cache(%{"thread" => "post", "article_id" => article_id}) do
    GroupherServer.CMS.Tickets.Cache.purge_post(article_id)
  end

  defp purge_ticket_cache(_data), do: {:ok, :pass}

  defp normalize(:ok), do: {:ok, :pass}
  defp normalize({:ok, _}), do: {:ok, :pass}
  defp normalize({:error, reason}), do: {:error, reason}
end
