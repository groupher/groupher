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
  import Helper.ErrorCode

  alias GroupherServer.CMS.Gate.PublishThrottle

  def call(%{context: %{cur_user: cur_user}} = resolution, opt) do
    with {:ok, _} <- PublishThrottle.check(cur_user, opt) do
      resolution
    else
      {:error, :interval_check} ->
        resolution
        |> handle_absinthe_error("throttle_interval", ecode(:throttle_interval))

      {:error, :hour_limit_check} ->
        resolution
        |> handle_absinthe_error("throttle_hour", ecode(:throttle_hour))

      {:error, :day_limit_check} ->
        resolution
        |> handle_absinthe_error("throttle_day", ecode(:throttle_day))

      {:error, _error} ->
        # publish first time ignore
        resolution
    end
  end

  def call(resolution, _) do
    resolution
    |> handle_absinthe_error("Authorize: need login", ecode(:account_login))
  end
end
