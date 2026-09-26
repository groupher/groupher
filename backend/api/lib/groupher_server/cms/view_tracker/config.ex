defmodule GroupherServer.CMS.ViewTracker.Config do
  @moduledoc """
  Runtime limits for synchronous Article view counting and retention.

      ViewTracker transaction / Retention -> Config -> runtime values
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

  @doc "Returns how long finalized transport receipts remain eligible for cleanup."
  @spec view_count_receipt_ttl_seconds() :: pos_integer()
  def view_count_receipt_ttl_seconds do
    value = runtime() |> Keyword.get(:view_count_receipt_ttl_seconds, 960)
    validate_positive!(:view_count_receipt_ttl_seconds, value)
    value
  end

  @doc "Returns how long inactive viewer watermarks are retained."
  @spec watermark_retention_seconds() :: pos_integer()
  def watermark_retention_seconds do
    value = runtime() |> Keyword.get(:watermark_retention_seconds, 30 * 86_400)
    validate_positive!(:watermark_retention_seconds, value)

    if value <= max(dedupe_window_seconds(:human), dedupe_window_seconds(:agent)) do
      raise ArgumentError,
            "watermark_retention_seconds must exceed every actor dedupe window"
    end

    value
  end

  @doc "Returns the maximum rows removed by one Retention batch."
  @spec retention_batch_size() :: pos_integer()
  def retention_batch_size do
    value = runtime() |> Keyword.get(:retention_batch_size, 500)
    validate_positive!(:retention_batch_size, value)
    value
  end

  defp runtime do
    Application.get_env(:groupher_server, __MODULE__, [])
  end

  defp validate_positive!(_name, value) when is_integer(value) and value > 0, do: value

  defp validate_positive!(name, value),
    do: raise(ArgumentError, "#{name} must be a positive integer, got: #{inspect(value)}")
end
