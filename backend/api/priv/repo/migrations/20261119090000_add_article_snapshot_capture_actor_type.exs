defmodule GroupherServer.Repo.Migrations.AddArticleSnapshotCaptureActorType do
  use Ecto.Migration

  @prefix "cms"

  def up do
    execute("ALTER TABLE cms.article_snapshots ALTER COLUMN captured_by_id DROP NOT NULL")

    execute(
      "ALTER TABLE cms.article_snapshots ADD COLUMN IF NOT EXISTS capture_actor_type text NOT NULL DEFAULT 'user'"
    )

    execute(
      """
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'cms.article_snapshots'::regclass
            AND conname = 'article_snapshots_capture_actor_check'
        ) THEN
          ALTER TABLE cms.article_snapshots
          ADD CONSTRAINT article_snapshots_capture_actor_check
          CHECK (
            (capture_actor_type = 'user' AND captured_by_id IS NOT NULL) OR
            (capture_actor_type = 'system' AND captured_by_id IS NULL)
          );
        END IF;
      END $$;
      """
    )
  end

  def down do
    execute(
      "ALTER TABLE cms.article_snapshots DROP CONSTRAINT IF EXISTS article_snapshots_capture_actor_check"
    )

    alter table(:article_snapshots, prefix: @prefix) do
      remove(:capture_actor_type)
    end

    execute("ALTER TABLE cms.article_snapshots ALTER COLUMN captured_by_id SET NOT NULL")
  end
end
