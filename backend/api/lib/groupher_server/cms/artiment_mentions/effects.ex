defmodule GroupherServer.CMS.ArtimentMentions.Effects do
  @moduledoc """
  Records durable User notification intents inside their source transaction.

      published revision -> Outbox event -> notifier worker
  """

  alias GroupherServer.CMS

  @doc "Delivers one committed Mention notification intent."
  defdelegate deliver_notifications(source_id, revision_identity, community_id, recipient_ids, event_id),
    to: CMS.ArtimentMentions.Effects.Notifications,
    as: :deliver
  @doc "Enqueues one notification event per source and published revision."
  @spec enqueue_notifications(Ecto.UUID.t(), String.t(), tuple(), integer(), [integer()]) ::
          {:ok, CMS.Outbox.Event.t()} | {:error, term()}
  def enqueue_notifications(
        source_endpoint_id,
        revision_identity,
        identity,
        community_id,
        recipient_ids \\ []
      )

  def enqueue_notifications(
        source_endpoint_id,
        revision_identity,
        _identity,
        community_id,
        recipient_ids
      )
      when is_binary(source_endpoint_id) and is_binary(revision_identity) and
             is_integer(community_id) and is_list(recipient_ids) do
    key =
      :crypto.hash(:sha256, source_endpoint_id <> ":" <> revision_identity)
      |> Base.encode16(case: :lower)

    CMS.Outbox.send(%{
      event: "mention.notify",
      resource_type: "mention_source",
      resource_id: source_endpoint_id,
      identity: {:workflow, "mention.notify:" <> key},
      effect_key: "mention.notify:" <> key,
      worker: GroupherServer.Jobs.CMSMentionNotifier,
      data: %{
        source_endpoint_id: source_endpoint_id,
        published_revision_identity: revision_identity,
        community_id: community_id,
        notify_user_ids: recipient_ids
      }
    })
  end

  def enqueue_notifications(_, _, _, _, _), do: {:error, :invalid_mention_notification_event}
end
