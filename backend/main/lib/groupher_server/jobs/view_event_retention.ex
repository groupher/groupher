defmodule GroupherServer.Jobs.ViewEventRetention do
  @moduledoc """
  Daily cleanup and telemetry worker for processed view events.

  Business position:

      Oban cron -> ViewEventRetention -> view_events retention + telemetry
  """

  use Oban.Worker, queue: :default, max_attempts: 3

  alias GroupherServer.CMS.Interactions.ViewEvents

  @impl Oban.Worker
  def perform(%Oban.Job{}) do
    _ = ViewEvents.delete_expired()
    :telemetry.execute([:groupher, :cms, :reactions, :view_metrics], ViewEvents.metrics(), %{})
    :ok
  end
end
