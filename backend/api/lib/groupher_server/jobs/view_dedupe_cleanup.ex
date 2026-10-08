defmodule GroupherServer.Jobs.ViewDedupeCleanup do
  @moduledoc """
  Periodically drains expired Article-view dedupe state.

      Oban cron -> ViewDedupeCleanup -> CMS.ViewTracker.ViewDedupeCleanup
  """

  use Oban.Worker, queue: :default, max_attempts: 3

  alias GroupherServer.CMS
  alias CMS.ViewTracker

  @impl Oban.Worker
  def perform(%Oban.Job{}) do
    _ = ViewTracker.cleanup_expired()
    {:ok, :pass}
  end
end
