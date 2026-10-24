defmodule GroupherServer.CMS.Outbox.Workflow.Comment do
  @moduledoc """
  Delivers public cache cleanup intents created by Comment writes.

  Business position:

      Oban outbox job
        -> Outbox.execute lease + fencing
        -> Comment Effects / projection delivery
        -> complete / retry / snooze / terminal failure
  """

  alias GroupherServer.Accounts

  alias GroupherServer.{CMS, ErrorCat, Jobs, Repo}
  alias CMS.Outbox
  alias CMS.Comments.ErrorCat, as: CommentErrorCat
  alias CMS.Model.{Article, Comment, Community}
  alias CMS.SearchArtiments.Indexer
  alias Accounts.Model.User

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
        with {:ok, _} <- purge_comment_cache(event) do
          {:ok, :purged}
        end

      "comment.deleted" ->
        with %Article{} = article <- Repo.get(Article, event.resource_id),
             {:ok, _} <- normalize(Indexer.enqueue_metrics(article)) do
          {:ok, :effects_enqueued}
        else
          nil -> {:error, CommentErrorCat.not_exist("Comment parent Article")}
        end

      action ->
        comment_effects(action, event)
    end
  end

  defp comment_effects(action, event)
       when action in ["comment.created", "comment.replied", "comment.updated"] do
    with %Comment{} = comment <- Repo.get(Comment, event.resource_id),
         %User{} = actor <- Repo.get(User, event.data["actor_id"]),
         %Community{} = community <- Repo.get(Community, event.data["community_id"]),
         {:ok, _} <- enqueue_comment_job(action, comment, actor, community) do
      {:ok, :effects_enqueued}
    else
      nil -> {:error, CommentErrorCat.effect_target_not_found()}
    end
  end

  defp comment_effects(_action, _event), do: {:error, CommentErrorCat.unknown_outbox_event()}

  defp enqueue_comment_job("comment.created", comment, actor, community) do
    with {:ok, _} <- enqueue(:sync_mentions, comment.id, fn -> Jobs.sync_mentions(comment) end),
         {:ok, _} <-
           enqueue(:subscribe_community, community.id, fn ->
             Jobs.subscribe_community(community, actor)
           end) do
      {:ok, :pass}
    end
  end

  defp enqueue_comment_job("comment.replied", comment, _actor, _community) do
    enqueue(:sync_mentions, comment.id, fn -> Jobs.sync_mentions(comment) end)
  end

  defp enqueue_comment_job("comment.updated", comment, _actor, _community) do
    enqueue(:sync_mentions, comment.id, fn -> Jobs.sync_mentions(comment) end)
  end

  defp enqueue(type, key, fun), do: Jobs.enqueue_best_effort(type, key, fun)

  defp purge_comment_cache(event) do
    with {:ok, tags} <-
           GroupherServer.PublicCache.scope_tags(:comments_content_changed, event.data),
         {:ok, result} <- GroupherServer.PublicCache.cloudflare_purge(tags) do
      {:ok, result}
    end
  end

  defp normalize(:ok), do: {:ok, :pass}
  defp normalize({:ok, _}), do: {:ok, :pass}
  defp normalize({:error, reason}), do: {:error, reason}
end
