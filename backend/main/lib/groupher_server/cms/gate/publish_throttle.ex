defmodule GroupherServer.CMS.Gate.PublishThrottle do
  @moduledoc """
  Gate facade for publish frequency admission and accounting.

  Business position:

      CMS operation
        -> CMS.Gate
        -> PublishThrottle
        -> allow / deny
        -> domain context
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Gate.Passport.Registry
  alias GroupherServer.CMS.Policy.Config
  alias GroupherServer.CMS.Policy.Model.PublishThrottle, as: ThrottleRecord
  alias Helper.Datetime

  @interval_minutes Config.publish_throttle().interval_minutes
  @hour_limit Config.publish_throttle().hour_limit
  @day_total Config.publish_throttle().day_limit

  defdelegate log_publish_action(user), to: GroupherServer.CMS.Policy.PublishThrottle
  defdelegate load_publish_throttle(user), to: GroupherServer.CMS.Policy.PublishThrottle

  defdelegate mock_publish_throttle_attr(scope, user, opt),
    to: GroupherServer.CMS.Policy.PublishThrottle

  @spec check(map(), keyword()) :: {:ok, :publish} | {:error, atom()}
  def check(user, opts \\ [])

  def check(user, opts) when is_map(user) do
    passport = Map.get(user, :cur_passport)
    user = %User{id: Map.get(user, :id)}

    if get_in(Registry.normalize_rules(passport), ["global", "god"]) == true do
      {:ok, :publish}
    else
      with {:ok, record} <- load_publish_throttle(user),
           {:ok, _} <- interval_check(record, opts),
           {:ok, _} <- hour_limit_check(record, opts),
           {:ok, _} <- day_limit_check(record, opts) do
        {:ok, :publish}
      end
    end
  end

  def check(_user, _opts), do: {:error, :missing_user}

  defp interval_check(%ThrottleRecord{last_publish_time: last_publish_time}, opts) do
    interval = Keyword.get(opts, :interval) || @interval_minutes
    latest_valid_time = Datetime.shift(last_publish_time, minutes: interval)

    if DateTime.before?(latest_valid_time, Datetime.now()),
      do: {:ok, :interval_check},
      else: {:error, :interval_check}
  end

  defp hour_limit_check(%ThrottleRecord{hour_count: hour_count}, opts) do
    limit = Keyword.get(opts, :hour_limit) || @hour_limit

    if hour_count < limit, do: {:ok, :hour_limit_check}, else: {:error, :hour_limit_check}
  end

  defp day_limit_check(%ThrottleRecord{date_count: day_count}, opts) do
    limit = Keyword.get(opts, :day_limit) || @day_total

    if day_count < limit, do: {:ok, :day_limit_check}, else: {:error, :day_limit_check}
  end
end
