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

  @doc "Freezes the Comment request Community identity before asynchronous delivery."
  def reaction_data(%Comment{} = comment, data) do
    with {:ok, community} <- CMS.Comments.RequestCommunity.resolve(comment) do
      {:ok, Map.put(data, :community_id, community.id)}
    end
  end

  def reaction_data(_article, data), do: {:ok, data}

  @doc "Records one changed reaction intent for the current interaction transaction."
  @spec enqueue_reaction_changed(
          String.t(),
          String.t(),
          term(),
          Ecto.UUID.t(),
          map(),
          keyword()
        ) :: {:ok, :pass} | {:error, term()}
  def enqueue_reaction_changed(event, resource_type, resource_id, command_id, data, opts \\ [])

  def enqueue_reaction_changed(event, resource_type, resource_id, command_id, data, opts)
      when is_binary(event) and is_binary(resource_type) and is_binary(command_id) and
             is_map(data) and is_list(opts) do
    %{
      event: event,
      worker: GroupherServer.Jobs.CMSOutboxInteraction,
      resource_type: resource_type,
      resource_id: resource_id,
      identity: {:command, command_id},
      effect_key: Keyword.get(opts, :effect_key, "default"),
      data: data
    }
    |> CMS.Outbox.send()
    |> case do
      {:ok, _event} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end

  def enqueue_reaction_changed(_event, _resource_type, _resource_id, _command_id, _data, _opts) do
    {:error, :interaction_effect_identity_required}
  end
end
