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
  alias GroupherServer.{Accounts, CMS, ErrorCat}
  alias GroupherServerWeb.ErrorResponse

  def call(%{context: %{cur_user: cur_user}} = resolution, opt) do
    case GroupherServer.CMS.gate_rate_limit_publish_check(cur_user, opt) do
      {:ok, _} ->
        resolution

      {:error, %ErrorCat.Error{reason: :throttle_interval}} ->
        ErrorResponse.put_error(resolution, CMS.gate_error_cat_throttle_interval())

      {:error, %ErrorCat.Error{reason: :throttle_hour}} ->
        ErrorResponse.put_error(resolution, CMS.gate_error_cat_throttle_hour())

      {:error, %ErrorCat.Error{reason: :throttle_day}} ->
        ErrorResponse.put_error(resolution, CMS.gate_error_cat_throttle_day())

      {:error, _error} ->
        # publish first time ignore
        resolution
    end
  end

  def call(resolution, _) do
    ErrorResponse.put_error(resolution, Accounts.profiles_error_cat_account_login())
  end
end
