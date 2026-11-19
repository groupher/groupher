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

  alias GroupherServer.CMS
  alias CMS.Model.Comment
  alias CMS.Outbox.DedupeKey

  @doc "Freezes the Comment request Community identity before asynchronous delivery."
  def reaction_data(%Comment{} = comment, data) do
    with {:ok, community} <- CMS.Comments.RequestCommunity.resolve(comment) do
      {:ok, Map.put(data, :community_id, community.id)}
    end
  end

  def reaction_data(_article, data), do: {:ok, Map.put_new(data, :community_id, nil)}

  @doc "Records one changed reaction intent for the current interaction transaction."
  @spec enqueue_reaction_changed(
          String.t(),
          String.t(),
          term(),
          Ecto.UUID.t(),
          map()
        ) :: {:ok, :pass} | {:error, term()}
  def enqueue_reaction_changed(event, resource_type, resource_id, operation_ref, data)

  def enqueue_reaction_changed(event, resource_type, resource_id, operation_ref, data)
      when is_binary(event) and is_binary(resource_type) and is_binary(operation_ref) and
             is_map(data) do
    data = Map.put_new(data, :community_id, nil)

    %{
      event: event,
      worker: GroupherServer.Jobs.CMSOutboxInteraction,
      resource_type: resource_type,
      resource_id: resource_id,
      operation_ref: operation_ref,
      dedupe_key:
        DedupeKey.encode([
          event,
          resource_type,
          resource_id,
          Map.get(data, :actor_id) || Map.get(data, "actor_id"),
          Map.get(data, :operation) || Map.get(data, "operation"),
          Map.get(data, :emotion) || Map.get(data, "emotion"),
          Map.get(data, :community_id) || Map.get(data, "community_id")
        ]),
      data: data
    }
    |> CMS.Outbox.send()
    |> case do
      {:ok, _event} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end

  def enqueue_reaction_changed(_event, _resource_type, _resource_id, _operation_ref, _data) do
    {:error, :interaction_effect_identity_required}
  end
end
