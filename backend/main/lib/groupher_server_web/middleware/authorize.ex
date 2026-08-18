# ---
# Absinthe.Middleware behaviour
# ---
defmodule GroupherServerWeb.Middleware.Authorize do
  @moduledoc """
  Rejects GraphQL fields that require a current authenticated user.

  It also projects credential-verification failures from the context into the
  shared GraphQL error contract.

  Business position:

      Absinthe context
        -> Authorize
        -> authenticated resolver or auth error
        -> GraphQL response
  """

  @behaviour Absinthe.Middleware

  import Helper.Utils, only: [handle_absinthe_error: 3]
  import Helper.ErrorCode

  def call(%{context: %{cur_user: _}} = resolution, _info), do: resolution

  def call(%{context: %{auth_failure: code}} = resolution, _info) do
    Absinthe.Resolution.put_result(
      resolution,
      {:error, [message: "Authorize: browser token is invalid", code: code]}
    )
  end

  def call(resolution, _) do
    resolution
    |> handle_absinthe_error("Authorize: need login", ecode(:account_login))
  end
end
