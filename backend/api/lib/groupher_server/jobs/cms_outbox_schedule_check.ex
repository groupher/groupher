defmodule GroupherServer.Jobs.CMSOutboxScheduleCheck do
  @moduledoc """
  Periodic Oban entrypoint for bounded CMS Outbox schedule reconciliation.

      Oban Cron -> CMSOutboxScheduleCheck -> Outbox.ScheduleCheck
  """

  use Oban.Worker, queue: :default, max_attempts: 3

  alias GroupherServer.CMS

  @impl Oban.Worker
  @doc """
  Runs one bounded consistency check for CMS Outbox wakeups.

  ## Examples

      perform(%Oban.Job{})
  """
  def perform(%Oban.Job{}) do
    case CMS.reconcile_outbox_schedules() do
      {:ok, _summary} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end
end
