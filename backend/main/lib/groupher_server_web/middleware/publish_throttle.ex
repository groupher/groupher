defmodule GroupherServerWeb.Middleware.PublishThrottle do
  @moduledoc """
  Enforces the CMS publication rate policy at the GraphQL boundary.

  Authorization is delegated to `CMS.Gate`; interval, hourly, and daily denials
  are translated into the corresponding public error codes.

  Business position:

      Publish mutation
        -> PublishThrottle
        -> CMS.Gate policy check
        -> resolver or throttle error
  """

  @behaviour Absinthe.Middleware
  import Helper.Utils, only: [handle_absinthe_error: 3]
  alias GroupherServer.ErrorCat
  alias GroupherServer.ErrorCat.Error

  alias GroupherServer.CMS.Gate.RateLimit.Publish, as: PublishThrottle

  def call(%{context: %{cur_user: cur_user}} = resolution, opt) do
    with {:ok, _} <- PublishThrottle.check(cur_user, opt) do
      resolution
    else
      {:error, %Error{reason: :throttle_interval}} ->
        resolution
        |> handle_absinthe_error(
          "throttle_interval",
          ErrorCat.code(GroupherServer.CMS.Gate.RateLimit.ErrorCat.throttle_interval())
        )

      {:error, %Error{reason: :throttle_hour}} ->
        resolution
        |> handle_absinthe_error(
          "throttle_hour",
          ErrorCat.code(GroupherServer.CMS.Gate.RateLimit.ErrorCat.throttle_hour())
        )

      {:error, %Error{reason: :throttle_day}} ->
        resolution
        |> handle_absinthe_error(
          "throttle_day",
          ErrorCat.code(GroupherServer.CMS.Gate.RateLimit.ErrorCat.throttle_day())
        )

      {:error, _error} ->
        # publish first time ignore
        resolution
    end
  end

  def call(resolution, _) do
    resolution
    |> handle_absinthe_error(
      "Authorize: need login",
      ErrorCat.code(GroupherServer.Accounts.Profiles.ErrorCat.account_login())
    )
  end
end
