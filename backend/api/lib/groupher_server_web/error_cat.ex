defmodule GroupherServerWeb.ErrorCat do
  @moduledoc """
  Web boundary error catalog for HTTP and GraphQL-facing failures.

  Web request failure -> catalog reason -> stable protocol error.
  """

  use GroupherServer.ErrorCat.Domain, namespace: {:web}

  error(:pagination, code: 4002)
  error(:service_auth, code: 4017)
  error(:changeset, code: 4102)
  error(:invalid_service_token, code: 4018)
  error(:malformed_token, code: 4019)
  error(:unknown_kid, code: 4020)
  error(:jwks_unavailable, code: 4021, retryable: true)
  error(:invalid_claims, code: 4022)
  error(:service_token_unavailable, code: 4023, retryable: true)
  error(:blocked_ip, code: 4024)
  error(:blocked_host, code: 4025)
  error(:invalid_url, code: 4026)
  error(:invalid_scheme, code: 4027)
  error(:missing_host, code: 4028)
  error(:resolve_failed, code: 4029, retryable: true)
  error(:unsafe_url, code: 4030)
end
