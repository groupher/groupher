defmodule GroupherServer.Repo.Migrations.RemoveDocsPlanDigests do
  use Ecto.Migration

  def up do
    execute(
      "LOCK TABLE cms.docs_publish_approvals, cms.doc_publish_releases IN ACCESS EXCLUSIVE MODE"
    )

    execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM cms.docs_publish_approvals)
         OR EXISTS (SELECT 1 FROM cms.doc_publish_releases) THEN
        RAISE EXCEPTION 'R4 requires empty Docs approval and Release tables; no historical plan conversion';
      END IF;
    END $$
    """)

    alter table(:docs_publish_approvals, prefix: "cms") do
      remove(:plan_hash)
      remove(:hash_algorithm)
    end

    alter table(:doc_publish_releases, prefix: "cms") do
      remove(:plan_hash)
      remove(:hash_algorithm)
    end
  end

  def down do
    raise "R4 has no digest compatibility rollback"
  end
end
