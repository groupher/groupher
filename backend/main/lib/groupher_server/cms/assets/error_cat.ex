defmodule GroupherServer.CMS.Assets.ErrorCat do
  @moduledoc """
  CMS asset ownership and processing error catalog.

  Asset operation -> catalog reason -> stable protocol error.
  """

  use GroupherServer.ErrorCat.Domain, namespace: {:cms, :asset}

  error(:not_exist, code: 5601)
  error(:skipped, code: 5602)
  error(:delete_enqueue_failed, code: 5603, retryable: true)
end
