defmodule GroupherServer.Repo.Migrations.AddArticleEventSnapshotLineageIndex do
  use Ecto.Migration

  def up do
    execute(
      "CREATE INDEX article_events_snapshot_lineage_idx " <>
        "ON cms.article_events (article_id, after_snapshot_id, sequence DESC)"
    )
  end

  def down do
    execute("DROP INDEX cms.article_events_snapshot_lineage_idx")
  end
end
