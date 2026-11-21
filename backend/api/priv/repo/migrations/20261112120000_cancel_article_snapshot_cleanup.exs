defmodule GroupherServer.Repo.Migrations.CancelArticleSnapshotCleanup do
  use Ecto.Migration

  # Stop old application instances before migrating: changing an executing job's
  # state cannot interrupt a worker already deleting snapshots.
  def up do
    execute("""
    UPDATE public.oban_jobs
    SET state = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
    WHERE worker = 'GroupherServer.Jobs.ArticleSnapshotCleanup'
      AND state IN ('available', 'scheduled', 'retryable', 'executing')
    """)
  end

  # Rolling back must never reactivate a destructive history cleanup job.
  def down, do: :ok
end
