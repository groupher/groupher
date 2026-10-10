defmodule GroupherServer.CMS.Wallpaper.ErrorCat do
  @moduledoc """
  Wallpaper settings, Snapshot, and generated Batch error catalog.

  Wallpaper operation -> typed domain reason -> GraphQL ErrorCat boundary.
  """

  use GroupherServer.ErrorCat.Domain, namespace: {:cms, :wallpaper}

  error(:wallpaper_publish_version_conflict, code: 5702)
  error(:wallpaper_snapshot_not_restorable, code: 5703)
  error(:wallpaper_publish_base_version_invalid, code: 5704)
  error(:wallpaper_publish_command_id_invalid, code: 5705)
  error(:wallpaper_settings_invalid, code: 5706)
  error(:wallpaper_publish_command_conflict, code: 5708)
  error(:wallpaper_publish_lease_too_short, code: 5709, retryable: true)
  error(:wallpaper_publish_transaction_timeout, code: 5710, retryable: true)
  error(:wallpaper_upload_batch_required, code: 5711)
  error(:wallpaper_none_publish_must_not_have_batch, code: 5712)
  error(:wallpaper_publish_capability_invalid, code: 5713)
  error(:wallpaper_publish_manifest_invalid, code: 5714)
  error(:wallpaper_upload_images_invalid, code: 5715)
  error(:wallpaper_upload_image_invalid, code: 5716)
  error(:wallpaper_assets_hub_claim_failed, code: 5717, retryable: true)
  error(:wallpaper_assets_hub_cleanup_failed, code: 5718, retryable: true)
end
