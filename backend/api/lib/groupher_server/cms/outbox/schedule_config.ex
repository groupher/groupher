defmodule GroupherServer.CMS.Outbox.ScheduleConfig do
  @moduledoc """
  Runtime bounds for Outbox schedule reconciliation.

  The grace period starts after `available_at` for waiting/retrying events, and
  after the delivery lease deadline for running events.

      App config -> ScheduleConfig -> validated grace period -> ScheduleCheck
  """

  @default_stale_after_seconds 300
  @minimum_stale_after_seconds 181
  @maximum_stale_after_seconds 86_400

  @doc "Returns the validated stale-job grace period in seconds."
  @spec stale_after_seconds() :: pos_integer()
  def stale_after_seconds do
    value =
      Application.get_env(:groupher_server, __MODULE__, [])
      |> Keyword.get(:outbox_schedule_stale_after_seconds, @default_stale_after_seconds)

    if is_integer(value) and value in @minimum_stale_after_seconds..@maximum_stale_after_seconds do
      value
    else
      raise ArgumentError,
            "outbox_schedule_stale_after_seconds must be an integer between " <>
              "#{@minimum_stale_after_seconds} and #{@maximum_stale_after_seconds}"
    end
  end
end
