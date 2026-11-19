defmodule GroupherServer.CMS.Outbox.Workflow.Asset do
  @moduledoc """
  Reliably delivers provider deletion intents for deleted assets.

  Business position:

      Oban outbox job
        -> Outbox.execute lease + fencing
        -> Asset Effects provider deletion
        -> complete / retry / snooze / terminal failure
  """

  alias GroupherServer.{CMS, ErrorCat}
  alias CMS.Assets.Effects

  @doc """
  Delivers one asset-provider deletion event under the Outbox lease.

  Busy leases snooze; transient provider errors retry; exhausted deliveries are
  recorded as failed by Outbox and acknowledged so Oban stops retrying them.
  """
  @spec perform(Oban.Job.t()) :: Oban.Worker.result()
  def perform(%Oban.Job{args: %{"event_id" => event_id}} = job) do
    case CMS.Outbox.execute(event_id, &delete_provider_object/1,
           on_error: if(job.attempt >= job.max_attempts, do: :fail, else: :classify)
         ) do
      {:ok, _value} ->
        {:ok, :pass}

      {:busy, seconds} ->
        {:snooze, seconds}

      {:snooze, seconds} ->
        {:snooze, seconds}

      {:error,
       %ErrorCat.Error{
         namespace: {:cms},
         reason: :outbox_delivery_exhausted
       }} ->
        {:ok, :pass}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp delete_provider_object(event) do
    with {:ok, target} <- CMS.Assets.Deletion.provider_delete_target(event) do
      normalize_delete_result(Effects.deliver_provider_delete(target))
    end
  end

  defp normalize_delete_result({:ok, :pass}), do: {:ok, :enqueued}
  defp normalize_delete_result({:error, reason}), do: {:error, reason}
end
