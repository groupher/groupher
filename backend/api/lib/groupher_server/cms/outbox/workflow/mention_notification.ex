defmodule GroupherServer.CMS.Outbox.Workflow.MentionNotification do
  @moduledoc """
  Delivers User notifications for one published Mention revision.

      mention.notify Outbox event -> validate current revision -> User inbox delivery
  """

  alias GroupherServer.{CMS, ErrorCat}
  alias CMS.ArtimentMentions.Effects
  alias CMS.Outbox

  @doc "Processes one notification Outbox event with the configured retry policy."
  @spec perform(Oban.Job.t()) :: Oban.Worker.result()
  def perform(%Oban.Job{args: %{"event_id" => event_id}} = job) do
    case Outbox.execute(event_id, &notify/1,
           on_error: if(job.attempt >= job.max_attempts, do: :fail, else: :classify)
         ) do
      {:ok, _value} ->
        {:ok, :pass}

      {:busy, seconds} ->
        {:snooze, seconds}

      {:snooze, seconds} ->
        {:snooze, seconds}

      {:error, %ErrorCat.Error{namespace: {:cms}, reason: :outbox_delivery_exhausted}} ->
        {:ok, :pass}

      {:error, reason} ->
        {:error, reason}
    end
  end

  def perform(_job), do: {:error, CMS.ErrorCat.invalid_mention_notification_event()}

  defp notify(%{event: "mention.notify", resource_type: "mention_source", data: data} = event)
       when is_map(data) do
    source_id = data["source_endpoint_id"]
    revision_identity = data["published_revision_identity"]
    community_id = data["community_id"]
    recipients = Map.get(data, "notify_user_ids", [])

    if event.resource_id == source_id and is_binary(revision_identity) and
         is_integer(community_id) and is_list(recipients) do
      Effects.deliver_notifications(source_id, revision_identity, community_id, recipients, event.id)
    else
      {:error, CMS.ErrorCat.invalid_mention_notification_event()}
    end
  end

  defp notify(_event), do: {:error, CMS.ErrorCat.invalid_mention_notification_event()}
end
