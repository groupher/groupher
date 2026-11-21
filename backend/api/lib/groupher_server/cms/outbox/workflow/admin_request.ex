defmodule GroupherServer.CMS.Outbox.Workflow.AdminRequest do
  @moduledoc """
  Delivers durable Admin request notices and invalidates recipient mailboxes.

      Oban job -> CMS -> Outbox.Workflow -> Messaging -> mailbox cache
  """

  alias GroupherServer.{Accounts, CMS, ErrorCat, Messaging}
  alias CMS.Outbox

  @doc "Executes one Admin request notice under Outbox delivery fencing."
  def perform(%Oban.Job{args: %{"event_id" => event_id}} = job) do
    case Outbox.execute(event_id, &Messaging.notify(:community_admin_request, &1),
           on_error: if(job.attempt >= job.max_attempts, do: :fail, else: :classify)
         ) do
      {:ok, {_notice, users}} ->
        _ = Accounts.mailbox_invalidate_users(users)
        {:ok, :pass}

      {:ok, :done} ->
        {:ok, :pass}

      {:ok, :already_delivered} ->
        {:ok, :pass}

      {:ok, :pass} ->
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

  def perform(_), do: {:error, invalid_event()}

  defp invalid_event, do: CMS.ErrorCat.invalid_body("invalid admin request outbox event")
end
