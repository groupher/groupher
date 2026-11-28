defmodule GroupherServer.CMS.Gate.RateLimit.Publish.Workflow do
  @moduledoc """
  Owns publish throttle reads, window resets, and accounting writes.

  The parent `RateLimit.Publish` module is a public facade. Keeping the ORM
  access here makes the transaction/data owner explicit without changing the
  admission contract used by CMS Gate callers.

      publish request -> load/reset throttle -> limit checks -> allow/deny
  """

  import Ecto.Query, warn: false
  import ShortMaps

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Gate.ErrorCat
  alias CMS.Gate.RateLimit.Publish.{Config, Model.PublishThrottle}
  alias Helper.{Datetime, ORM}
  alias Helper.ORM.AdvisoryLock

  @doc """
  Checks a publish request against interval, hour, and day limits.

  ## Examples

      Workflow.check(user, interval: 3)
      #=> {:ok, :publish} | {:error, error}
  """
  @spec check(map(), keyword()) :: {:ok, :publish} | {:error, ErrorCat.error()}
  def check(user, opts \\ [])

  def check(user, opts) when is_map(user) do
    user = %User{id: Map.get(user, :id)}

    if system_root?(user.id) do
      {:ok, :publish}
    else
      case load_and_reset(user) do
        {:ok, record} ->
          with {:ok, _} <- interval_check(record, opts),
               {:ok, _} <- hour_limit_check(record, opts),
               {:ok, _} <- day_limit_check(record, opts) do
            {:ok, :publish}
          end

        {:error, %{details: %{reason: :not_exist}}} ->
          {:ok, :publish}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  def check(_user, _opts) do
    {:error, GroupherServer.Accounts.profiles_error_cat_account_login()}
  end

  @doc "Checks publish limits while retaining the caller's transaction and advisory lock."
  @spec check_in_transaction(map(), keyword()) :: {:ok, :publish} | {:error, term()}
  def check_in_transaction(user, opts \\ [])

  def check_in_transaction(user, opts) when is_map(user) and is_list(opts) do
    user_id = Map.get(user, :id)

    cond do
      not Repo.in_transaction?() ->
        {:error, :transaction_required}

      system_root?(user_id) ->
        {:ok, :publish}

      true ->
        with {:ok, :acquired} <- AdvisoryLock.acquire!(lock_key(user_id)),
             result <- check_locked(user_id, opts) do
          result
        end
    end
  end

  def check_in_transaction(_user, _opts), do: {:error, :invalid_actor}

  defp system_root?(user_id) do
    case CMS.Passport.system_root?(user_id) do
      {:ok, true} -> true
      _ -> false
    end
  rescue
    _ -> false
  end

  defp check_locked(user_id, opts) do
    case load_and_reset_locked(user_id) do
      {:ok, record} -> check_record(record, opts)
      {:error, %{details: %{reason: :not_exist}}} -> {:ok, :publish}
      {:error, reason} -> {:error, reason}
    end
  end

  defp check_record(record, opts) do
    with {:ok, _} <- interval_check(record, opts),
         {:ok, _} <- hour_limit_check(record, opts),
         {:ok, _} <- day_limit_check(record, opts) do
      {:ok, :publish}
    end
  end

  defp interval_check(%PublishThrottle{last_publish_time: last_publish_time}, opts) do
    configured_interval = Config.publish_throttle().interval_minutes
    interval = Keyword.get(opts, :interval) || configured_interval
    latest_valid_time = Datetime.shift(last_publish_time, minutes: interval)

    if (interval == 0 and configured_interval == 0 and
          Application.get_env(:groupher_server, :env) == :dev) or
         DateTime.before?(latest_valid_time, Datetime.now()) do
      {:ok, :interval_check}
    else
      {:error, ErrorCat.throttle_interval()}
    end
  end

  defp hour_limit_check(%PublishThrottle{hour_count: hour_count}, opts) do
    limit = Keyword.get(opts, :hour_limit) || Config.publish_throttle().hour_limit
    if hour_count < limit, do: {:ok, :hour_limit_check}, else: {:error, ErrorCat.throttle_hour()}
  end

  defp day_limit_check(%PublishThrottle{date_count: day_count}, opts) do
    limit = Keyword.get(opts, :day_limit) || Config.publish_throttle().day_limit
    if day_count < limit, do: {:ok, :day_limit_check}, else: {:error, ErrorCat.throttle_day()}
  end

  @doc """
  Records a successful publish and increments the actor counters.

  ## Examples

      Workflow.record(user)
      #=> {:ok, %PublishThrottle{}}
  """
  @spec record(User.t()) :: {:ok, PublishThrottle.t()} | {:error, term()}
  def record(%User{id: user_id}) do
    Repo.transact_result(fn ->
      with {:ok, :acquired} <- AdvisoryLock.acquire!(lock_key(user_id)) do
        record_locked(user_id)
      end
    end)
  end

  defp record_locked(user_id) do
    cur_date = Datetime.today() |> Date.to_iso8601()
    cur_datetime = DateTime.utc_now() |> DateTime.to_iso8601()

    last_publish_time = cur_datetime
    publish_hour = cur_datetime
    publish_date = cur_date

    case PublishThrottle |> ORM.find_by(~m(user_id)a) do
      {:ok, record} ->
        date_count = record.date_count + 1
        hour_count = record.hour_count + 1

        attrs = %{
          user_id: user_id,
          publish_date: publish_date,
          publish_hour: publish_hour,
          date_count: date_count,
          hour_count: hour_count,
          last_publish_time: last_publish_time
        }

        record |> ORM.update(attrs)

      {:error, _} ->
        date_count = 1
        hour_count = 1

        attrs = %{
          user_id: user_id,
          publish_date: publish_date,
          publish_hour: publish_hour,
          date_count: date_count,
          hour_count: hour_count,
          last_publish_time: last_publish_time
        }

        PublishThrottle |> ORM.create(attrs)
    end
  end

  @doc """
  Loads the actor throttle row and atomically resets expired windows.

  ## Examples

      Workflow.load_and_reset(user)
      #=> {:ok, %PublishThrottle{}}
  """
  @spec load_and_reset(User.t()) :: {:ok, PublishThrottle.t()} | {:error, term()}
  def load_and_reset(%User{id: user_id}) do
    Repo.transact_result(fn ->
      with {:ok, :acquired} <- AdvisoryLock.acquire!(lock_key(user_id)),
           {:ok, record} <- load_and_reset_locked(user_id) do
        {:ok, record}
      end
    end)
  end

  defp load_and_reset_locked(user_id) do
    with {:ok, record} <- PublishThrottle |> ORM.find_by(~m(user_id)a) do
      date_expired? = not same_day?(record.publish_date)
      hour_expired? = not same_hour?(record.publish_hour)

      date_count = if date_expired?, do: 0, else: record.date_count
      hour_count = if hour_expired?, do: 0, else: record.hour_count

      if date_expired? or hour_expired? do
        cur_date = Datetime.today() |> Date.to_iso8601()
        cur_datetime = DateTime.utc_now() |> DateTime.to_iso8601()

        attrs = %{
          publish_date: cur_date,
          publish_hour: cur_datetime,
          date_count: date_count,
          hour_count: hour_count
        }

        ORM.update(record, attrs)
      else
        {:ok, record}
      end
    end
  end

  defp same_day?(datetime), do: Datetime.to_date(datetime) == Datetime.today()

  defp same_hour?(datetime) do
    %{hour: record_hour} = DateTime.to_time(datetime)
    %{hour: cur_hour} = Datetime.now() |> DateTime.to_time()
    record_hour == cur_hour and same_day?(datetime)
  end

  defp lock_key(user_id), do: "publish_throttle:user:#{user_id}"

  @doc false
  def mock_publish_throttle_attr(:last_publish_time, %User{id: user_id}, minutes: minutes) do
    with {:ok, record} <- PublishThrottle |> ORM.find_by(~m(user_id)a) do
      last_publish_time = Datetime.shift(record.last_publish_time, minutes: minutes)
      record |> ORM.update(%{last_publish_time: last_publish_time})
    end
  end

  def mock_publish_throttle_attr(:hour_count, %User{id: user_id}, count: hour_count) do
    with {:ok, record} <- PublishThrottle |> ORM.find_by(~m(user_id)a) do
      record |> ORM.update(%{hour_count: hour_count})
    end
  end

  def mock_publish_throttle_attr(:publish_hour, %User{id: user_id}, hours: hours) do
    with {:ok, record} <- PublishThrottle |> ORM.find_by(~m(user_id)a) do
      publish_hour = Datetime.shift(record.publish_hour, hours: hours)
      record |> ORM.update(%{publish_hour: publish_hour})
    end
  end

  def mock_publish_throttle_attr(:date_count, %User{id: user_id}, count: date_count) do
    with {:ok, record} <- PublishThrottle |> ORM.find_by(~m(user_id)a) do
      record |> ORM.update(%{date_count: date_count})
    end
  end

  def mock_publish_throttle_attr(:publish_date, %User{id: user_id}, days: days) do
    with {:ok, record} <- PublishThrottle |> ORM.find_by(~m(user_id)a) do
      publish_date = record.publish_hour |> Datetime.shift(days: days) |> Datetime.to_date()
      record |> ORM.update(%{publish_date: publish_date})
    end
  end
end
