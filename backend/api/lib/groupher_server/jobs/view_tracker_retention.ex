defmodule GroupherServer.Jobs.ViewTrackerRetention do
  @moduledoc """
  Daily bounded cleanup worker for ViewTracker receipts and watermarks.

  Business position:

      Oban cron -> ViewTrackerRetention -> ViewTracker.Retention
  """

  use Oban.Worker, queue: :default, max_attempts: 3

  alias GroupherServer.CMS.ViewTracker

  @impl Oban.Worker
  def perform(%Oban.Job{}) do
    _ = ViewTracker.delete_expired()
    :ok
  end
end
