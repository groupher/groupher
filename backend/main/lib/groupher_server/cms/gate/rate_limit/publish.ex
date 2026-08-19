defmodule GroupherServer.CMS.Gate.RateLimit.Publish do
  @moduledoc """
  Gate facade for publish frequency admission and accounting.

  Business position:

      CMS operation
        -> CMS.Gate
        -> RateLimit.Publish
        -> allow / deny
        -> domain context

  Examples:

      iex> {:ok, :publish} = check(%{id: 1, cur_passport: %{}})
      iex> {:ok, _record} = record(%GroupherServer.Accounts.Model.User{id: 1})
  """

  import Ecto.Query, warn: false
  import ShortMaps

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Passport.Registry
  alias GroupherServer.CMS.Policy.Config
  alias GroupherServer.CMS.Policy.Model.PublishThrottle, as: ThrottleRecord
  alias GroupherServer.Accounts.Profiles.ErrorCat, as: AuthErrorCat
  alias GroupherServer.CMS.Gate.RateLimit.ErrorCat
  alias Helper.{Datetime, ORM}

  @interval_minutes Config.publish_throttle().interval_minutes
  @hour_limit Config.publish_throttle().hour_limit
  @day_total Config.publish_throttle().day_limit

  @doc "Checks whether the actor may publish within the configured limits."
  @spec check(map(), keyword()) :: {:ok, :publish} | {:error, GroupherServer.ErrorCat.Error.t()}
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

  def check(_user, _opts), do: {:error, AuthErrorCat.account_login()}

  defp interval_check(%ThrottleRecord{last_publish_time: last_publish_time}, opts) do
    interval = Keyword.get(opts, :interval) || @interval_minutes
    latest_valid_time = Datetime.shift(last_publish_time, minutes: interval)

    if DateTime.before?(latest_valid_time, Datetime.now()),
      do: {:ok, :interval_check},
      else: {:error, ErrorCat.throttle_interval()}
  end

  defp hour_limit_check(%ThrottleRecord{hour_count: hour_count}, opts) do
    limit = Keyword.get(opts, :hour_limit) || @hour_limit

    if hour_count < limit, do: {:ok, :hour_limit_check}, else: {:error, ErrorCat.throttle_hour()}
  end

  defp day_limit_check(%ThrottleRecord{date_count: day_count}, opts) do
    limit = Keyword.get(opts, :day_limit) || @day_total

    if day_count < limit, do: {:ok, :day_limit_check}, else: {:error, ErrorCat.throttle_day()}
  end

  @doc "Records a successful publish for the actor."
  def record(%User{id: user_id}) do
    cur_date = Datetime.today() |> Date.to_iso8601()
    cur_datetime = DateTime.utc_now() |> DateTime.to_iso8601()

    last_publish_time = cur_datetime
    publish_hour = cur_datetime
    publish_date = cur_date

    case ThrottleRecord |> ORM.find_by(~m(user_id)a) do
      {:ok, record} ->
        date_count = record.date_count + 1
        hour_count = record.hour_count + 1

        attrs = ~m(user_id publish_date publish_hour date_count hour_count last_publish_time)a
        record |> ORM.update(attrs)

      {:error, _} ->
        date_count = 1
        hour_count = 1
        attrs = ~m(user_id publish_date publish_hour date_count hour_count last_publish_time)a
        ThrottleRecord |> ORM.create(attrs)
    end
  end

  @doc false
  # auto run check for same hour / day
  def load_publish_throttle(%User{id: user_id}) do
    with {:ok, record} <- ThrottleRecord |> ORM.find_by(~m(user_id)a) do
      date_count = if same_day?(record.publish_date), do: record.date_count, else: 0
      hour_count = if same_hour?(record.publish_hour), do: record.hour_count, else: 0

      case date_count !== 0 or hour_count !== 0 do
        true ->
          cur_date = Datetime.today() |> Date.to_iso8601()
          cur_datetime = DateTime.utc_now() |> DateTime.to_iso8601()

          publish_hour = cur_datetime
          publish_date = cur_date

          attrs = ~m(publish_date publish_hour date_count hour_count)a
          record |> ORM.update(attrs)

        false ->
          {:ok, record}
      end
    end
  end

  defp same_day?(datetime) do
    Datetime.to_date(datetime) == Datetime.today()
  end

  defp same_hour?(datetime) do
    %{hour: record_hour} = DateTime.to_time(datetime)
    %{hour: cur_hour} = Datetime.now() |> DateTime.to_time()

    same_hour? = record_hour == cur_hour

    same_day?(datetime) and same_hour?
  end

  @doc false
  # NOTE: the mock_xxx helpers are only used by tests.
  def mock_publish_throttle_attr(:last_publish_time, %User{id: user_id}, minutes: minutes) do
    with {:ok, record} <- ThrottleRecord |> ORM.find_by(~m(user_id)a) do
      last_publish_time = Datetime.shift(record.last_publish_time, minutes: minutes)
      record |> ORM.update(~m(last_publish_time)a)
    end
  end

  def mock_publish_throttle_attr(:hour_count, %User{id: user_id}, count: hour_count) do
    with {:ok, record} <- ThrottleRecord |> ORM.find_by(~m(user_id)a) do
      record |> ORM.update(~m(hour_count)a)
    end
  end

  def mock_publish_throttle_attr(:publish_hour, %User{id: user_id}, hours: hours) do
    with {:ok, record} <- ThrottleRecord |> ORM.find_by(~m(user_id)a) do
      publish_hour = Datetime.shift(record.publish_hour, hours: hours)
      record |> ORM.update(~m(publish_hour)a)
    end
  end

  def mock_publish_throttle_attr(:date_count, %User{id: user_id}, count: date_count) do
    with {:ok, record} <- ThrottleRecord |> ORM.find_by(~m(user_id)a) do
      record |> ORM.update(~m(date_count)a)
    end
  end

  def mock_publish_throttle_attr(:publish_date, %User{id: user_id}, days: days) do
    with {:ok, record} <- ThrottleRecord |> ORM.find_by(~m(user_id)a) do
      publish_date = record.publish_hour |> Datetime.shift(days: days) |> Datetime.to_date()
      record |> ORM.update(~m(publish_date)a)
    end
  end
end
