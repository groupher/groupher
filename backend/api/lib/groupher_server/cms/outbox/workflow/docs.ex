defmodule GroupherServer.CMS.Outbox.Workflow.Docs do
  @moduledoc """
  Delivers committed Docs approval status notifications.

      Docs status Outbox -> idempotent per-user notices
  """

  alias GroupherServer.{CMS, ErrorCat}
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

  def perform(_job), do: {:error, CMS.ErrorCat.command_result_unavailable()}

  defp notify(event), do: CMS.DocTree.Publication.Notifications.deliver(event)
end
