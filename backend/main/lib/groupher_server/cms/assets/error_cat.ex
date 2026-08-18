defmodule GroupherServer.CMS.Assets.ErrorCat do
  @moduledoc false

  use GroupherServer.ErrorCat.Domain, namespace: {:cms, :asset}

  error(:not_exist, code: 5601)
  error(:skipped, code: 5602)
  error(:delete_enqueue_failed, code: 5603, retryable: true)
end
