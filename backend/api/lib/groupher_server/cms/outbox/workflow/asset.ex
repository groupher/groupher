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
    deliver_provider_object(event.resource_type, event)
  end

  defp deliver_provider_object("community_asset", event) do
    case Repo.get(CommunityAsset, event.resource_id) do
      %CommunityAsset{
        id: id,
        status: :deleted,
        deleted_at: deleted_at,
        public_ref: public_ref,
        storage: storage,
        storage_key: storage_key
      } = asset ->
        if not is_nil(deleted_at) and id == event.data["asset_id"] and
             public_ref == event.data["public_ref"] and storage == event.data["storage"] and
             storage_key == event.data["storage_key"] and is_binary(storage) and
             storage != "" and is_binary(storage_key) and storage_key != "" do
          normalize_delete_result(Effects.deliver_provider_delete(asset))
        else
          {:error, AssetErrorCat.provider_delete_target_invalid()}
        end

      _asset ->
        {:error, AssetErrorCat.provider_delete_target_invalid()}
    end
  end

  defp deliver_provider_object("application_logo_upload", event) do
    normalize_delete_result(Effects.deliver_application_upload_delete(event.data))
  end

  defp deliver_provider_object(resource_type, _event) do
    {:error, AssetErrorCat.unsupported_asset_cleanup_resource(%{resource_type: resource_type})}
  end

  defp normalize_delete_result({:ok, :pass}), do: {:ok, :enqueued}
  defp normalize_delete_result({:error, reason}), do: {:error, reason}
end
