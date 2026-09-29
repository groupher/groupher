defmodule GroupherServer.CMS.ViewTracker.Config do
  @moduledoc """
  Runtime limits for synchronous Article view counting and dedupe cleanup.

      ViewCounter / ViewDedupeCleanup -> Config -> runtime values
  """

  @doc "Returns the sliding dedupe window for one counted actor type."
  @spec dedupe_window_seconds(:human | :agent) :: pos_integer()
  def dedupe_window_seconds(:human) do
    value = runtime() |> Keyword.get(:human_dedupe_window_seconds, 600)
    validate_positive!(:human_dedupe_window_seconds, value)
    value
  end

  def dedupe_window_seconds(:agent) do
    value = runtime() |> Keyword.get(:agent_dedupe_window_seconds, 600)
    validate_positive!(:agent_dedupe_window_seconds, value)
    value
  end

  @doc "Returns the delay added after an actor window before dedupe state may be cleaned."
  @spec cleanup_safety_margin_seconds() :: pos_integer()
  def cleanup_safety_margin_seconds,
    do: positive_runtime(:cleanup_safety_margin_seconds, 86_400)

  @doc "Returns the complete lifetime of one actor's dedupe state."
  @spec dedupe_state_ttl_seconds(:human | :agent) :: pos_integer()
  def dedupe_state_ttl_seconds(actor_type) do
    dedupe_window_seconds(actor_type) + cleanup_safety_margin_seconds()
  end

  @doc "Returns the maximum rows removed by one cleanup batch."
  @spec cleanup_batch_size() :: pos_integer()
  def cleanup_batch_size,
    do: positive_runtime(:cleanup_batch_size, 500)

  @doc "Returns the maximum rows removed by one cleanup run."
  @spec cleanup_row_budget() :: pos_integer()
  def cleanup_row_budget,
    do: positive_runtime(:cleanup_row_budget, 50_000)

  @doc "Returns the wall-clock budget for one cleanup run."
  @spec cleanup_time_budget_ms() :: pos_integer()
  def cleanup_time_budget_ms,
    do: positive_runtime(:cleanup_time_budget_ms, 25_000)

  defp runtime do
    Application.get_env(:groupher_server, __MODULE__, [])
  end

  defp positive_runtime(name, default) do
    value = runtime() |> Keyword.get(name, default)
    validate_positive!(name, value)
    value
  end

  defp validate_positive!(_name, value) when is_integer(value) and value > 0, do: value

  defp validate_positive!(name, value),
    do: raise(ArgumentError, "#{name} must be a positive integer, got: #{inspect(value)}")
end
