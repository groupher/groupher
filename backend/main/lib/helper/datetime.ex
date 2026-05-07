defmodule Helper.Datetime do
  @moduledoc """
  UTC-only date and datetime helpers for application code.

  Use this module instead of local-time helpers so database timestamps and
  date-window queries stay stable across server timezone changes.
  """

  @type date_or_datetime :: Date.t() | DateTime.t()
  @type shift_unit ::
          :year
          | :years
          | :month
          | :months
          | :week
          | :weeks
          | :day
          | :days
          | :hour
          | :hours
          | :minute
          | :minutes
          | :second
          | :seconds
          | :microsecond
          | :microseconds
  @type shift_opts :: [{shift_unit(), integer()}]

  @utc "Etc/UTC"

  @doc """
  Returns the current UTC datetime.

  ## Examples

      iex> %DateTime{time_zone: "Etc/UTC"} = Helper.Datetime.now()

  """
  @spec now() :: DateTime.t()
  def now, do: DateTime.utc_now()

  @doc """
  Returns the current UTC datetime truncated to seconds.

  ## Examples

      iex> Helper.Datetime.now(:second).microsecond
      {0, 0}

  """
  @spec now(:second) :: DateTime.t()
  def now(:second), do: now() |> DateTime.truncate(:second)

  @doc """
  Returns today's date in UTC.

  ## Examples

      iex> %Date{} = Helper.Datetime.today()

  """
  @spec today() :: Date.t()
  def today, do: Date.utc_today()

  @doc """
  Converts a date to midnight UTC, or normalizes an existing datetime to UTC.

  ## Examples

      iex> Helper.Datetime.to_datetime(~D[2026-05-07])
      ~U[2026-05-07 00:00:00Z]

  """
  @spec to_datetime(Date.t()) :: DateTime.t()
  @spec to_datetime(DateTime.t()) :: DateTime.t()
  def to_datetime(%Date{} = date), do: DateTime.new!(date, ~T[00:00:00], @utc)
  def to_datetime(%DateTime{} = datetime), do: to_utc(datetime)

  @doc """
  Converts a datetime to its UTC date, or returns an existing date unchanged.

  ## Examples

      iex> Helper.Datetime.to_date(~U[2026-05-07 08:30:00Z])
      ~D[2026-05-07]

  """
  @spec to_date(date_or_datetime()) :: Date.t()
  def to_date(%Date{} = date), do: date
  def to_date(%DateTime{} = datetime), do: datetime |> to_utc() |> DateTime.to_date()

  @doc """
  Shifts a date or datetime by calendar units.

  Both Timex-style plural units and Elixir-style singular units are accepted.

  ## Examples

      iex> Helper.Datetime.shift(~D[2026-05-07], days: -7)
      ~D[2026-04-30]

      iex> Helper.Datetime.shift(~U[2026-05-07 08:30:00Z], hours: 2)
      ~U[2026-05-07 10:30:00Z]

  """
  @spec shift(Date.t(), shift_opts()) :: Date.t()
  @spec shift(DateTime.t(), shift_opts()) :: DateTime.t()
  def shift(%Date{} = date, opts), do: Date.shift(date, normalize_shift_opts(opts))

  def shift(%DateTime{} = datetime, opts),
    do: DateTime.shift(datetime, normalize_shift_opts(opts))

  @doc """
  Returns the start of the UTC day.

  ## Examples

      iex> Helper.Datetime.beginning_of_day(~U[2026-05-07 08:30:00Z])
      ~U[2026-05-07 00:00:00Z]

  """
  @spec beginning_of_day(date_or_datetime()) :: DateTime.t()
  def beginning_of_day(date_or_datetime) do
    date_or_datetime
    |> to_date()
    |> to_datetime()
  end

  @doc """
  Returns the end of the UTC day.

  ## Examples

      iex> Helper.Datetime.end_of_day(~D[2026-05-07])
      ~U[2026-05-07 23:59:59.999999Z]

  """
  @spec end_of_day(date_or_datetime()) :: DateTime.t()
  def end_of_day(date_or_datetime) do
    date_or_datetime
    |> to_date()
    |> DateTime.new!(~T[23:59:59.999999], @utc)
  end

  @doc """
  Returns the start of the UTC week.

  The week starts on Monday, matching Elixir's `Date.beginning_of_week/1`.

  ## Examples

      iex> Helper.Datetime.beginning_of_week(~D[2026-05-07])
      ~U[2026-05-04 00:00:00Z]

  """
  @spec beginning_of_week(date_or_datetime()) :: DateTime.t()
  def beginning_of_week(date_or_datetime) do
    date_or_datetime
    |> to_date()
    |> Date.beginning_of_week()
    |> to_datetime()
  end

  @doc """
  Returns the end of the UTC week.

  ## Examples

      iex> Helper.Datetime.end_of_week(~D[2026-05-07])
      ~U[2026-05-10 23:59:59.999999Z]

  """
  @spec end_of_week(date_or_datetime()) :: DateTime.t()
  def end_of_week(date_or_datetime) do
    date_or_datetime
    |> to_date()
    |> Date.end_of_week()
    |> end_of_day()
  end

  @doc """
  Returns the start of the UTC month.

  ## Examples

      iex> Helper.Datetime.beginning_of_month(~D[2026-05-07])
      ~U[2026-05-01 00:00:00Z]

  """
  @spec beginning_of_month(date_or_datetime()) :: DateTime.t()
  def beginning_of_month(date_or_datetime) do
    date_or_datetime
    |> to_date()
    |> Date.beginning_of_month()
    |> to_datetime()
  end

  @doc """
  Returns the end of the UTC month.

  ## Examples

      iex> Helper.Datetime.end_of_month(~D[2026-05-07])
      ~U[2026-05-31 23:59:59.999999Z]

  """
  @spec end_of_month(date_or_datetime()) :: DateTime.t()
  def end_of_month(date_or_datetime) do
    date_or_datetime
    |> to_date()
    |> Date.end_of_month()
    |> end_of_day()
  end

  @doc """
  Returns the start of the UTC year.

  ## Examples

      iex> Helper.Datetime.beginning_of_year(~D[2026-05-07])
      ~U[2026-01-01 00:00:00Z]

  """
  @spec beginning_of_year(date_or_datetime()) :: DateTime.t()
  def beginning_of_year(date_or_datetime) do
    %{year: year} = to_date(date_or_datetime)
    to_datetime(%Date{year: year, month: 1, day: 1})
  end

  @doc """
  Returns the end of the UTC year.

  ## Examples

      iex> Helper.Datetime.end_of_year(~D[2026-05-07])
      ~U[2026-12-31 23:59:59.999999Z]

  """
  @spec end_of_year(date_or_datetime()) :: DateTime.t()
  def end_of_year(date_or_datetime) do
    %{year: year} = to_date(date_or_datetime)
    end_of_day(%Date{year: year, month: 12, day: 31})
  end

  defp normalize_shift_opts(opts) do
    opts
    |> Keyword.new(fn
      {:years, value} -> {:year, value}
      {:months, value} -> {:month, value}
      {:weeks, value} -> {:week, value}
      {:days, value} -> {:day, value}
      {:hours, value} -> {:hour, value}
      {:minutes, value} -> {:minute, value}
      {:seconds, value} -> {:second, value}
      {:microseconds, value} -> {:microsecond, value}
      {unit, value} -> {unit, value}
    end)
  end

  defp to_utc(%DateTime{} = datetime) do
    {_, precision} = datetime.microsecond

    datetime
    |> DateTime.to_unix(:microsecond)
    |> DateTime.from_unix!(:microsecond)
    |> then(fn utc_datetime ->
      {microsecond, _} = utc_datetime.microsecond
      %{utc_datetime | microsecond: {microsecond, precision}}
    end)
  end
end
