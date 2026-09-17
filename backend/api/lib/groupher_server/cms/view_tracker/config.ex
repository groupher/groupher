defmodule GroupherServer.CMS.ViewTracker.Config do
  @moduledoc """
  Runtime limits for ViewTracker projection and retention.

      ViewTracker worker -> Config -> application runtime configuration
  """

  @doc "Returns the sliding dedupe window in seconds."
  @spec dedupe_window_seconds() :: pos_integer()
  def dedupe_window_seconds do
    value = runtime() |> Keyword.get(:dedupe_window_seconds, 600)
    validate_positive!(:dedupe_window_seconds, value)
    value
  end

  @doc "Returns how many days terminal ViewEvents remain before cleanup."
  @spec view_event_retention_days() :: pos_integer()
  def view_event_retention_days do
    value = runtime() |> Keyword.get(:view_event_retention_days, 30)
    validate_positive!(:view_event_retention_days, value)
    value
  end

  @doc "Returns how many days dedupe states remain after their last counted view."
  @spec dedupe_state_retention_days() :: pos_integer()
  def dedupe_state_retention_days do
    value = runtime() |> Keyword.get(:dedupe_state_retention_days, view_event_retention_days())
    validate_positive!(:dedupe_state_retention_days, value)

    if value * 86_400 <= dedupe_window_seconds() do
      raise ArgumentError,
            "dedupe_state_retention_days must cover more than dedupe_window_seconds"
    end

    value
  end

  @doc "Returns the maximum number of counted events projected in one batch."
  @spec batch_size() :: pos_integer()
  def batch_size do
    value = runtime() |> Keyword.get(:view_projection_batch_size, 100)
    validate_positive!(:view_projection_batch_size, value)
    value
  end

  @doc "Returns the maximum wall-clock window before a lost projection is dead-lettered."
  @spec projection_retry_window_seconds() :: pos_integer()
  def projection_retry_window_seconds do
    value = runtime() |> Keyword.get(:view_projection_retry_window_seconds, 86_400)
    validate_positive!(:view_projection_retry_window_seconds, value)
    value
  end

  defp runtime do
    Application.get_env(:groupher_server, __MODULE__, [])
  end

  defp validate_positive!(_name, value) when is_integer(value) and value > 0, do: value

  defp validate_positive!(name, value),
    do: raise(ArgumentError, "#{name} must be a positive integer, got: #{inspect(value)}")
end
