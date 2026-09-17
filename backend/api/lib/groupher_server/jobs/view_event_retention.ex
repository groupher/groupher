defmodule GroupherServer.Jobs.ViewEventRetention do
  @moduledoc """
  Daily cleanup and telemetry worker for processed view events.

  Business position:

      Oban cron -> ViewEventRetention -> ViewTracker retention + telemetry
  """

  use Oban.Worker, queue: :default, max_attempts: 3

  alias GroupherServer.CMS.ViewTracker

  @impl Oban.Worker
  def perform(%Oban.Job{}) do
    _ = ViewTracker.reconcile_dead_letters()
    _ = ViewTracker.delete_expired()
    :telemetry.execute([:groupher, :cms, :view_tracker, :metrics], ViewTracker.metrics(), %{})
    :ok
  end
end
