defmodule GroupherServer.ReviewBot.ErrorCat do
  @moduledoc """
  Stable errors for ReviewBot configuration and media validation.

      ReviewBot request -> validation error
  """

  use GroupherServer.ErrorCat, namespace: {:review_bot, :check}

  error(:config_not_found, code: 7401)
  error(:invalid_config, code: 7402)
  error(:unsupported_media, code: 7405)
  error(:provider_unavailable, code: 7406, retryable: true)
  error(:provider_protocol_error, code: 7407)
  error(:coverage_incomplete, code: 7408)
  error(:config_version_conflict, code: 7409)
end
