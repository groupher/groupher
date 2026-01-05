# ---
# Absinthe.Middleware behaviour
# ---
defmodule GroupherServerWeb.Middleware.FEOauthCheck do
  @moduledoc """
  authorize gateway, mainly for login check
  """

  @behaviour Absinthe.Middleware

  import Helper.Utils, only: [handle_absinthe_error: 3, get_config: 2]
  import Helper.ErrorCode

  @oauth_trust_code get_config(:oauth, :oauth_trust_code)

  def call(%{arguments: %{oauth_trust_code: code}} = resolution, _info) do
    case code == @oauth_trust_code do
      true ->
        resolution

      false ->
        resolution
        |> handle_absinthe_error("not trusted oauth provider", ecode(:oauth_trust_code))
    end
  end

  def call(resolution, _info) do
    resolution
    |> handle_absinthe_error("not trusted oauth provider", ecode(:oauth_trust_code))
  end
end
