defmodule GroupherServer.Repo.Migrations.AllowUnlinkedArticleForkHistory do
  use Ecto.Migration

  @prefix "cms"

  def change do
    drop(constraint(:article_events, :article_events_shape_check, prefix: @prefix))

    create(
      constraint(:article_events, :article_events_shape_check,
        prefix: @prefix,
        check:
          "(type = 'publish' AND previous_event_id IS NULL) OR (type = 'create' AND working_copy_id IS NOT NULL AND after_revision IS NOT NULL) OR (type = 'fork' AND working_copy_id IS NOT NULL AND after_revision IS NOT NULL) OR (type IN ('edit', 'restore') AND working_copy_id IS NOT NULL AND before_revision IS NOT NULL AND after_revision IS NOT NULL AND after_revision > before_revision AND before_snapshot_id IS NOT NULL AND (type <> 'restore' OR source_snapshot_id IS NOT NULL))"
      )
    )
  end
end
