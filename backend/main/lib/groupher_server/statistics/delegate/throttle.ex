defmodule GroupherServer.Statistics.Delegate.Throttle do
  @moduledoc """
  limit rate for publish content
  """

  import Ecto.Query, warn: false
  import ShortMaps

  alias GroupherServer.{Accounts, Statistics}

  alias Accounts.Model.User
  alias Statistics.Model.PublishThrottle

  alias Helper.{Datetime, ORM}

  def log_publish_action(%User{id: user_id}) do
    cur_date = Datetime.today() |> Date.to_iso8601()
    cur_datetime = DateTime.utc_now() |> DateTime.to_iso8601()

    last_publish_time = cur_datetime
    publish_hour = cur_datetime
    publish_date = cur_date

    case PublishThrottle |> ORM.find_by(~m(user_id)a) do
      {:ok, record} ->
        date_count = record.date_count + 1
        hour_count = record.hour_count + 1

        attrs = ~m(user_id publish_date publish_hour date_count hour_count last_publish_time)a
        record |> ORM.update(attrs)

      {:error, _} ->
        date_count = 1
        hour_count = 1
        attrs = ~m(user_id publish_date publish_hour date_count hour_count last_publish_time)a
        PublishThrottle |> ORM.create(attrs)
    end
  end

  # auto run check for same hour / day
  def load_throttle_record(%User{id: user_id}) do
    with {:ok, record} <- PublishThrottle |> ORM.find_by(~m(user_id)a) do
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

  # NOTE: the mock_xxx  is only use for test
  def mock_throttle_attr(:last_publish_time, %User{id: user_id}, minutes: minutes) do
    with {:ok, record} <- PublishThrottle |> ORM.find_by(~m(user_id)a) do
      last_publish_time = Datetime.shift(record.last_publish_time, minutes: minutes)
      record |> ORM.update(~m(last_publish_time)a)
    end
  end

  def mock_throttle_attr(:hour_count, %User{id: user_id}, count: hour_count) do
    with {:ok, record} <- PublishThrottle |> ORM.find_by(~m(user_id)a) do
      record |> ORM.update(~m(hour_count)a)
    end
  end

  def mock_throttle_attr(:publish_hour, %User{id: user_id}, hours: hours) do
    with {:ok, record} <- PublishThrottle |> ORM.find_by(~m(user_id)a) do
      publish_hour = Datetime.shift(record.publish_hour, hours: hours)
      record |> ORM.update(~m(publish_hour)a)
    end
  end

  def mock_throttle_attr(:date_count, %User{id: user_id}, count: date_count) do
    with {:ok, record} <- PublishThrottle |> ORM.find_by(~m(user_id)a) do
      record |> ORM.update(~m(date_count)a)
    end
  end

  def mock_throttle_attr(:publish_date, %User{id: user_id}, days: days) do
    with {:ok, record} <- PublishThrottle |> ORM.find_by(~m(user_id)a) do
      publish_date = record.publish_hour |> Datetime.shift(days: days) |> Datetime.to_date()
      record |> ORM.update(~m(publish_date)a)
    end
  end
end
