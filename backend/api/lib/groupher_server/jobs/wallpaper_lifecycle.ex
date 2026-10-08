defmodule GroupherServer.Jobs.WallpaperLifecycle do
  @moduledoc """
  Reconciles Wallpaper receipts, retired revisions, and abandoned generated assets.

  The operation is idempotent, so Oban may retry safely after partial external
  object deletion or a process crash.

      Oban cron
        -> Wallpaper lifecycle reconciliation
        -> expired receipts / revisions / orphan assets
        -> database cleanup and Assets Hub deletion queue
  """

  use Oban.Worker, queue: :default, max_attempts: 3

  @impl Oban.Worker
  def perform(%Oban.Job{}) do
    GroupherServer.CMS.Wallpaper.reconcile_lifecycle()
    {:ok, :pass}
  end
end
