defmodule GroupherServer.CMS.ArtimentMentions.Effects do
  @moduledoc """
  Records durable User notification intents inside their source transaction.

      published revision -> Outbox event -> notifier worker
  """

  alias GroupherServer.CMS
  alias CMS.Outbox.DedupeKey

  @doc "Delivers one committed Mention notification intent."
  defdelegate deliver_notifications(
                source_id,
                revision_identity,
                community_id,
                recipient_ids,
                event_id
              ),
              to: CMS.ArtimentMentions.Effects.Notifications,
              as: :deliver

  @doc "Enqueues one notification event per source and published revision."
  @spec enqueue_notifications(Ecto.UUID.t(), String.t(), Ecto.UUID.t(), integer(), [integer()]) ::
          {:ok, CMS.Outbox.Event.t()} | {:error, term()}
  def enqueue_notifications(
        source_endpoint_id,
        revision_identity,
        operation_ref,
        community_id,
        recipient_ids \\ []
      )

  def enqueue_notifications(
        source_endpoint_id,
        revision_identity,
        operation_ref,
        community_id,
        recipient_ids
      )
      when is_binary(source_endpoint_id) and is_binary(revision_identity) and
             is_integer(community_id) and is_list(recipient_ids) do
    {:ok, operation_ref} = Ecto.UUID.cast(operation_ref)

    key =
      DedupeKey.encode([
        source_endpoint_id,
        revision_identity,
        Enum.sort(Enum.uniq(recipient_ids))
      ])

    CMS.Outbox.send(%{
      event: "mention.notify",
      resource_type: "mention_source",
      resource_id: source_endpoint_id,
      operation_ref: operation_ref,
      dedupe_key: key,
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

  @doc "Projects immutable business fields for duplicate Outbox comparison."
  def payload_projection(event, data) do
    case event do
      "mention.notify" ->
        CMS.Outbox.Event.project_fields(data, [
          "source_endpoint_id",
          "published_revision_identity",
          "community_id",
          "notify_user_ids"
        ])

      _ ->
        {:error, {:outbox_event_owner_missing, event}}
    end
  end
end
