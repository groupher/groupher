defmodule Helper.QueryBuilder do
  @moduledoc """
  Composes shared Ecto filtering, sorting, pagination, and time-window query packs.

  Domain read models supply their base query and opt into these bounded clauses;
  this module does not own domain-specific visibility rules.

  Business position:

      Domain or web caller
        -> QueryBuilder
        -> normalized value / infrastructure
  """

  import Ecto.Query, warn: false

  alias Helper.Datetime

  @doc """
  load inner user field
  """
  def load_inner_users(queryable, filter) do
    queryable
    |> join(:inner, [f], u in assoc(f, :user))
    |> select([f, u], u)
    |> filter_pack(filter)
  end

  @doc """
  inserted in latest x month/days etc..
  """
  def recent_inserted(queryable, months: count) do
    end_of_today = Datetime.now() |> Datetime.end_of_day()
    x_months_ago = Datetime.today() |> Datetime.shift(months: -count) |> Datetime.to_datetime()

    queryable
    |> where([q], q.inserted_at >= ^x_months_ago)
    |> where([q], q.inserted_at <= ^end_of_today)
  end

  def recent_inserted(queryable, days: count) do
    end_of_today = Datetime.now() |> Datetime.end_of_day()
    x_days_ago = Datetime.today() |> Datetime.shift(days: -count) |> Datetime.to_datetime()

    queryable
    |> where([q], q.inserted_at >= ^x_days_ago)
    |> where([q], q.inserted_at <= ^end_of_today)
  end

  @doc "Runs `filter_pack` through the public `QueryBuilder` boundary."
  def filter_pack(queryable, filter) when is_map(filter) do
    # The lower the position, the lower the priority.
    queryable
    |> handle_sort_logic(filter)
    |> handle_timestamp_logic(filter)
    |> handle_general_logic(filter)
  end

  defp handle_sort_logic(queryable, filter) do
    Enum.reduce(filter, queryable, fn
      {:sort, :desc_active}, queryable ->
        queryable |> order_by(desc: :active_at)

      {:sort, :asc_active}, queryable ->
        queryable |> order_by(asc: :active_at)

      {:sort, :desc_inserted}, queryable ->
        # queryable |> order_by(^sort_strategy(:desc_inserted))
        queryable |> order_by(desc: :inserted_at)

      {:sort, :asc_inserted}, queryable ->
        queryable |> order_by(asc: :inserted_at)

      {:sort, :desc_index}, queryable ->
        queryable |> order_by(desc: :index)

      {:sort, :asc_index}, queryable ->
        queryable |> order_by(asc: :index)

      {:sort, :most_views}, queryable ->
        queryable |> order_by(desc: :views, desc: :inserted_at)

      {:sort, :least_views}, queryable ->
        queryable |> order_by(asc: :views, desc: :inserted_at)

      {:sort, :most_stars}, queryable ->
        queryable |> sort_by_count(:stars, :desc)

      {:sort, :least_stars}, queryable ->
        queryable |> sort_by_count(:stars, :asc)

      {_, _}, queryable ->
        queryable
    end)
  end

  defp handle_timestamp_logic(queryable, filter) do
    Enum.reduce(filter, queryable, fn
      {:when, :today}, queryable ->
        date = Datetime.now()

        queryable
        |> where([p], p.inserted_at >= ^Datetime.beginning_of_day(date))
        |> where([p], p.inserted_at <= ^Datetime.end_of_day(date))

      {:when, :this_week}, queryable ->
        date = Datetime.now()

        queryable
        |> where([p], p.inserted_at >= ^Datetime.beginning_of_week(date))
        |> where([p], p.inserted_at <= ^Datetime.end_of_week(date))

      {:when, :this_month}, queryable ->
        date = Datetime.now()

        queryable
        |> where([p], p.inserted_at >= ^Datetime.beginning_of_month(date))
        |> where([p], p.inserted_at <= ^Datetime.end_of_month(date))

      {:when, :this_year}, queryable ->
        date = Datetime.now()

        queryable
        |> where([p], p.inserted_at >= ^Datetime.beginning_of_year(date))
        |> where([p], p.inserted_at <= ^Datetime.end_of_year(date))

      {_, _}, queryable ->
        queryable
    end)
  end

  defp handle_general_logic(queryable, filter) do
    Enum.reduce(filter, queryable, fn
      {:first, first}, queryable ->
        queryable |> limit(^first)

      {_, _}, queryable ->
        queryable
    end)
  end

  defp sort_by_count(queryable, field, direction) do
    queryable
    |> join(:left, [p], s in assoc(p, ^field))
    |> group_by([p], p.id)
    |> select([p], p)
    |> order_by([_, s], {^direction, fragment("count(?)", s.id)})
  end
end
