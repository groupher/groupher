defmodule GroupherServer.CMS.Outbox.Workflow.Asset do
  @moduledoc """
  Reliably delivers provider deletion intents for deleted assets.

  Business position:

      Oban outbox job
        -> Outbox.execute lease + fencing
        -> Asset Effects provider deletion
        -> complete / retry / snooze / terminal failure
  """

  alias GroupherServer.{CMS, ErrorCat, Repo}
  alias CMS.Assets.Effects
  alias CMS.Assets.ErrorCat, as: AssetErrorCat
  alias CMS.Model.CommunityAsset

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
    deliver_provider_object(event.resource_type, event)
  end

  defp deliver_provider_object("community_asset", event) do
    case Repo.get(CommunityAsset, event.resource_id) do
      %CommunityAsset{} = asset -> normalize_delete_result(Effects.deliver_provider_delete(asset))
      nil -> {:ok, :already_deleted}
    end
  end

  defp deliver_provider_object("application_logo_upload", event) do
    normalize_delete_result(Effects.deliver_application_upload_delete(event.data))
  end

  defp deliver_provider_object(resource_type, _event) do
    {:error, AssetErrorCat.unsupported_asset_cleanup_resource(%{resource_type: resource_type})}
  end

  defp normalize_delete_result({:ok, _result}), do: {:ok, :deleted}
  defp normalize_delete_result({:error, reason}), do: {:error, reason}
end
