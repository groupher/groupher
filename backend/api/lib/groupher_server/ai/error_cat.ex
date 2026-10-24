defmodule GroupherServer.AI.ErrorCat do
  @moduledoc """
  Stable errors for provider selection and normalized AI requests.

      AI.check -> provider adapter -> validated output or classified error
  """

  use GroupherServer.ErrorCat, namespace: {:ai, :check}

  error(:config_not_found, code: 7501)
  error(:invalid_config, code: 7502)
  error(:unsupported_media, code: 7503)
  error(:provider_unavailable, code: 7504, retryable: true)
  error(:provider_protocol_error, code: 7505)
  error(:coverage_incomplete, code: 7506)
  error(:invalid_opinion_input, code: 7507)
end
