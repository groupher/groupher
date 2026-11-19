defmodule GroupherServer.CMS.Interactions.Effects do
  @moduledoc """
  Owns in-transaction effects emitted by Interaction commands.

  This module records durable intent only. The caller owns the surrounding
  `CMS.Command` transaction; the shared Interaction outbox worker owns
  post-commit delivery.

      Interaction Command
        -> Interactions.Effects
        -> CMS.Outbox
        -> Interaction cleanup worker
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Interactions.Config
  alias CMS.Model.{Article, Comment}
  alias CMS.Outbox.DedupeKey

  @doc "Records one Article or Comment upvote change in the caller transaction."
  def upvote_changed(resource, actor, operation, operation_ref) do
    record("interaction.upvote_changed", resource, actor, operation, nil, operation_ref)
  end

  @doc "Records one Article or Comment emotion change in the caller transaction."
  def emotion_changed(resource, actor, operation, emotion, operation_ref) do
    vocabulary =
      case resource do
        %Article{} -> Config.emotions() -- [:upvote, :collect]
        %Comment{} -> Config.comment_emotions()
        _ -> []
      end

    if emotion in vocabulary do
      record("interaction.emotion_changed", resource, actor, operation, emotion, operation_ref)
    else
      {:error, :interaction_effect_identity_required}
    end
  end

  @doc "Records one Article collection change in the caller transaction."
  def collect_changed(%Article{} = article, actor, operation, operation_ref) do
    record("interaction.collect_changed", article, actor, operation, nil, operation_ref)
  end

  def collect_changed(_resource, _actor, _operation, _operation_ref) do
    {:error, :interaction_effect_identity_required}
  end

  defp record(event, resource, %User{id: actor_id}, operation, emotion, operation_ref)
       when is_integer(actor_id) and operation in [:add, :remove] and is_binary(operation_ref) do
    with {:ok, resource_type, resource_id, community_id} <- target(resource) do
      data = %{actor_id: actor_id, operation: operation, community_id: community_id}
      data = if is_nil(emotion), do: data, else: Map.put(data, :emotion, emotion)

      CMS.Outbox.send(%{
        event: event,
        worker: GroupherServer.Jobs.CMSOutboxInteraction,
        resource_type: resource_type,
        resource_id: resource_id,
        operation_ref: operation_ref,
        dedupe_key:
          DedupeKey.encode([
            operation_ref,
            event,
            resource_type,
            resource_id,
            actor_id,
            operation,
            emotion,
            community_id
          ]),
        data: data
      })
      |> case do
        {:ok, _event} -> {:ok, :pass}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp record(_event, _resource, _actor, _operation, _emotion, _operation_ref) do
    {:error, :interaction_effect_identity_required}
  end

  defp target(%Article{id: id}) when is_binary(id), do: {:ok, "article", id, nil}

  defp target(%Comment{id: id} = comment) when is_integer(id) do
    with {:ok, community} <- CMS.Comments.RequestCommunity.resolve(comment) do
      {:ok, "comment", id, community.id}
    end
  end

  defp target(_resource), do: {:error, :interaction_effect_identity_required}

  @doc "Projects immutable business fields for duplicate Outbox comparison."
  def payload_projection(event, data) do
    case event do
      "interaction.collect_changed" ->
        CMS.Outbox.Event.project_fields(data, ["actor_id", "operation", "community_id"])

      "interaction.emotion_changed" ->
        CMS.Outbox.Event.project_fields(data, ["actor_id", "operation", "emotion", "community_id"])

      "interaction.upvote_changed" ->
        CMS.Outbox.Event.project_fields(data, ["actor_id", "operation", "community_id"])

      _ ->
        {:error, {:outbox_event_owner_missing, event}}
    end
  end
end
