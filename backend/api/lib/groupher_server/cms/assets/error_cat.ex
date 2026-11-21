defmodule GroupherServer.CMS.Assets.ErrorCat do
  @moduledoc """
  CMS asset ownership and processing error catalog.

  Asset operation -> catalog reason -> stable protocol error.
  """

  use GroupherServer.ErrorCat, namespace: {:cms, :asset}

  error(:not_exist, code: 5601)
  error(:skipped, code: 5602)
  error(:delete_enqueue_failed, code: 5603, retryable: true)
  error(:unsupported_asset_cleanup_resource, code: 5604)
  error(:provider_delete_target_invalid, code: 5605, retryable: false)
  error(:asset_not_restorable, code: 5606, retryable: false)
  error(:storage_identity_conflict, code: 5607, retryable: false)
  error(:provider_delete_rejected, code: 5608, retryable: false)
  error(:provider_delete_failure_unclassified, code: 5609, retryable: false)
  error(:provider_delete_configuration_invalid, code: 5610, retryable: false)
end
