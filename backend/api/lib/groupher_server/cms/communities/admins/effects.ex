defmodule GroupherServer.CMS.Communities.Admins.Effects do
  @moduledoc """
  Owns transactional Admin request Activity and durable notification intents.

  Commands select recipients and authorize actors before invoking these effects.
  The delivery worker consumes each committed intent through Messaging.

      locked Admin request -> Activity + Outbox intent -> Messaging -> Notice
  """

  alias GroupherServer.{Activity, CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Model.{Community, CommunityAdminRequest}
  alias CMS.Outbox.DedupeKey

  @request_events [:created, :decided, :cancelled, :expired]

  @doc "Writes a Community Admin Activity under the caller-owned transaction."
  def activity(%Community{} = community, action, actor, operation_ref, index, metadata)
      when is_map(metadata) and is_integer(index) and index >= 0 do
    if Repo.in_transaction?() do
      Activity.log(community, action,
        actor: actor,
        source: if(actor == :system, do: :worker, else: :admin),
        operation_ref: operation_ref,
        operation_index: index,
        metadata: metadata
      )
    else
      {:error, :transaction_required}
    end
  end

  @doc "Enqueues one stable request intent per recipient in the caller's transaction."
  def request_notice(
        %Community{} = community,
        %CommunityAdminRequest{} = request,
        event,
        actor,
        recipients,
        operation_ref
      )
      when event in @request_events and is_list(recipients) and is_binary(operation_ref) do
    with true <- Repo.in_transaction?(),
         true <- request.community_id == community.id,
         {:ok, actor_data} <- actor_data(actor),
         true <- Enum.all?(recipients, &(is_integer(&1) and &1 > 0)) do
      recipients
      |> Enum.uniq()
      |> Enum.sort()
      |> Enum.reduce_while({:ok, []}, fn recipient, {:ok, sent} ->
        dedupe_key = DedupeKey.encode([request.id, request.revision, event, recipient])

        case CMS.Outbox.send(%{
               event: "community.admin_request",
               worker: GroupherServer.Jobs.CMSOutboxAdminRequest,
               resource_type: "community_admin_request",
               resource_id: request.id,
               operation_ref: operation_ref,
               dedupe_key: dedupe_key,
               data: %{
                 community_ref: community.slug,
                 request_id: request.id,
                 request_revision: request.revision,
                 request_type: "community_admin",
                 request_action: Atom.to_string(request.type),
                 event_type: event,
                 recipient_id: recipient,
                 actor: actor_data
               }
             }) do
          {:ok, intent} -> {:cont, {:ok, [intent | sent]}}
          {:error, _} = error -> {:halt, error}
        end
      end)
    else
      false -> {:error, :invalid_admin_request_effect}
      {:error, _} = error -> error
    end
  end

  def request_notice(_, _, _, _, _, _), do: {:error, :invalid_admin_request_effect}

  defp actor_data(%User{id: id}) when is_integer(id) and id > 0 do
    {:ok, %{type: :user, user_id: id}}
  end

  defp actor_data(:system), do: {:ok, %{type: :system}}
  defp actor_data(_), do: {:error, :invalid_admin_request_actor}

  @doc "Projects immutable business fields for duplicate Outbox comparison."
  def payload_projection(event, data) do
    case event do
      "community.admin_request" ->
        CMS.Outbox.Event.project_fields(data, [
          "community_ref",
          "request_id",
          "request_revision",
          "request_type",
          "request_action",
          "event_type",
          "recipient_id",
          "actor"
        ])

      _ ->
        {:error, {:outbox_event_owner_missing, event}}
    end
  end
end
