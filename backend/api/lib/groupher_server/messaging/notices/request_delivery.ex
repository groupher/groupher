defmodule GroupherServer.Messaging.Notices.RequestDelivery do
  @moduledoc """
  Persists a validated request Notice from a committed Outbox event.

  It owns the transaction that claims recipient dedup, inserts the Notice and
  rebuilds the recipient's mailbox projection. The Outbox worker only owns
  retries and cache invalidation.

      Messaging.notify -> RequestDelivery -> Dedup + Notice + mailbox projection
  """

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Model.Embeds
  alias GroupherServer.Messaging.Model.Notice
  alias GroupherServer.Messaging.Notices.Dedup

  @doc """
  Delivers one validated request event in an atomic Notice transaction.

  ## Examples

      RequestDelivery.deliver(outbox_event)
  """
  def deliver(event) do
    case Repo.transaction(fn ->
           case deliver_in_transaction(event) do
             {:ok, value} -> value
             {:error, reason} -> Repo.rollback(reason)
           end
         end) do
      {:ok, value} -> {:ok, value}
      {:error, reason} -> {:error, reason}
    end
  end

  defp deliver_in_transaction(
         %{event: "community.admin_request", resource_type: "community_admin_request", data: data} =
           event
       )
       when is_map(data) do
    with {:ok, recipient_id} <- positive_id(data["recipient_id"]),
         {:ok, request_id} <- uuid(data["request_id"]),
         {:ok, revision} <- positive_id(data["request_revision"]),
         {:ok, request_type} <- request_type(data["request_type"]),
         {:ok, event_type} <- event_type(data["event_type"]),
         {:ok, action} <- notice_action(data["event_type"], data["request_action"]),
         true <- event.resource_id == request_id,
         true <- is_binary(data["community_ref"]),
         {:ok, recipient} <- fetch_user(recipient_id),
         {:ok, actors} <- actors(data["actor"], event_type),
         {:ok, notice} <-
           write_notice(recipient, actors, action, request_type, request_id, revision, event_type),
         {:ok, users} <- Accounts.mailbox_update_status_many_in_transaction([recipient.id]) do
      {:ok, {notice, users}}
    else
      false -> {:error, invalid_event()}
      {:error, _} = error -> error
    end
  end

  defp deliver_in_transaction(_), do: {:error, invalid_event()}

  defp write_notice(recipient, actors, action, request_type, request_id, revision, event_type) do
    key = "admin-request:#{request_type}:#{request_id}:#{revision}:#{event_type}:#{recipient.id}"

    with {:ok, :claimed} <- Dedup.claim(key),
         changeset <-
           Notice.changeset(%Notice{}, %{
             user_id: recipient.id,
             type: action,
             title: "Community Admin request",
             read: false,
             request_type: request_type,
             request_id: request_id,
             request_revision: revision,
             event_type: event_type,
             from_users_count: length(actors),
             from_users: Enum.map(actors, &Map.from_struct/1)
           }),
         {:ok, notice} <- Repo.insert(changeset),
         {:ok, :pass} <- Dedup.attach(key, notice) do
      {:ok, notice}
    else
      {:ok, :already_delivered} -> {:ok, :already_delivered}
      {:error, reason} -> {:error, reason}
    end
  end

  defp actors(%{"type" => "user", "user_id" => id}, _event_type) do
    with {:ok, id} <- positive_id(id), {:ok, user} <- fetch_user(id) do
      {:ok, [Embeds.User.from_account_user(user)]}
    end
  end

  defp actors(%{"type" => "system"}, :expired), do: {:ok, []}
  defp actors(_, _), do: {:error, invalid_event()}

  defp fetch_user(id) do
    case Repo.get(User, id) do
      %User{} = user -> {:ok, user}
      nil -> {:error, :admin_request_notice_user_not_found}
    end
  end

  defp positive_id(value) when is_integer(value) and value > 0, do: {:ok, value}

  defp positive_id(value) when is_binary(value) do
    case Integer.parse(value) do
      {id, ""} when id > 0 -> {:ok, id}
      _ -> {:error, invalid_event()}
    end
  end

  defp positive_id(_), do: {:error, invalid_event()}

  defp uuid(value) when is_binary(value) do
    case Ecto.UUID.cast(value) do
      {:ok, id} -> {:ok, id}
      :error -> {:error, invalid_event()}
    end
  end

  defp uuid(_), do: {:error, invalid_event()}

  defp request_type("community_admin"), do: {:ok, :community_admin}
  defp request_type(_), do: {:error, invalid_event()}
  defp event_type("created"), do: {:ok, :created}
  defp event_type("decided"), do: {:ok, :decided}
  defp event_type("cancelled"), do: {:ok, :cancelled}
  defp event_type("expired"), do: {:ok, :expired}
  defp event_type(_), do: {:error, invalid_event()}
  defp notice_action("created", "invite"), do: {:ok, "invite"}
  defp notice_action("created", "apply"), do: {:ok, "apply"}

  defp notice_action(event, _) when event in ["decided", "cancelled", "expired"],
    do: {:ok, "result"}

  defp notice_action(_, _), do: {:error, invalid_event()}

  defp invalid_event, do: CMS.ErrorCat.invalid_body("invalid admin request outbox event")
end
