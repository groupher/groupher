defmodule GroupherServer.Jobs.CMSOutboxAdminRequest do
  @moduledoc """
  Delivers durable Community Admin request notices through Messaging.

      Outbox event -> Messaging.notify -> Dedup + Notice + mailbox projection
  """
  use Oban.Worker,
    queue: :cms_outbox,
    max_attempts: 8,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  alias GroupherServer.{Accounts, CMS, Messaging}
  alias CMS.Outbox

  @impl Oban.Worker
  @doc """
  Executes one durable request Notice intent; Oban retries transient failures.

  ## Examples

      perform(%Oban.Job{args: %{"event_id" => event_id}})
  """
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

      {:error,
       %GroupherServer.ErrorCat.Error{namespace: {:cms}, reason: :outbox_delivery_exhausted}} ->
        {:ok, :pass}

      {:error, reason} ->
        {:error, reason}
    end
  end

  def perform(_), do: {:error, invalid_event()}

  defp invalid_event, do: CMS.ErrorCat.invalid_body("invalid admin request outbox event")
end
