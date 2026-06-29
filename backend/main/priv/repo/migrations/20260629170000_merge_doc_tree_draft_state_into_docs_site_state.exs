defmodule GroupherServer.Repo.Migrations.MergeDocTreeDraftStateIntoDocsSiteState do
  use Ecto.Migration

  @prefix "cms"

  def up do
    alter table(:docs_site_states, prefix: @prefix) do
      add_if_not_exists(:tree_lock_version, :integer, null: false, default: 0)
      add_if_not_exists(:site_draft_version, :integer, null: false, default: 0)
      add_if_not_exists(:published_version, :integer, null: false, default: 0)
      add_if_not_exists(:staged_event_count, :integer, null: false, default: 0)

      add_if_not_exists(
        :base_snapshot_id,
        references(:doc_tree_snapshots, prefix: @prefix, on_delete: :nilify_all)
      )
    end

    flush()

    execute("""
    DO $$
    DECLARE
      has_base_snapshot boolean;
    BEGIN
      IF to_regclass('cms.doc_tree_draft_states') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'cms'
            AND table_name = 'docs_site_states'
            AND column_name = 'draft_revision'
        )
      THEN
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'cms'
            AND table_name = 'doc_tree_draft_states'
            AND column_name = 'base_snapshot_id'
        ) INTO has_base_snapshot;

        IF has_base_snapshot THEN
          EXECUTE '
            UPDATE cms.docs_site_states AS site
            SET
              tree_lock_version = COALESCE(tree.revision, site.tree_lock_version, 0),
              site_draft_version = COALESCE(site.draft_revision, site.site_draft_version, 0),
              published_version = COALESCE(
                site.last_published_draft_revision,
                site.published_version,
                0
              ),
              base_snapshot_id = COALESCE(tree.base_snapshot_id, site.base_snapshot_id),
              staged_event_count = COALESCE(
                tree.staged_event_count,
                site.staged_event_count,
                0
              )
            FROM cms.doc_tree_draft_states AS tree
            WHERE site.community_id = tree.community_id
          ';
        ELSE
          EXECUTE '
            UPDATE cms.docs_site_states AS site
            SET
              tree_lock_version = COALESCE(tree.revision, site.tree_lock_version, 0),
              site_draft_version = COALESCE(site.draft_revision, site.site_draft_version, 0),
              published_version = COALESCE(
                site.last_published_draft_revision,
                site.published_version,
                0
              ),
              staged_event_count = COALESCE(
                tree.staged_event_count,
                site.staged_event_count,
                0
              )
            FROM cms.doc_tree_draft_states AS tree
            WHERE site.community_id = tree.community_id
          ';
        END IF;
      END IF;
    END $$;
    """)

    alter table(:docs_site_states, prefix: @prefix) do
      remove_if_exists(:draft_revision, :integer)
      remove_if_exists(:published_revision, :integer)
      remove_if_exists(:last_published_draft_revision, :integer)
    end

    drop_if_exists(table(:doc_tree_draft_states, prefix: @prefix))
  end

  def down do
    create_if_not_exists table(:doc_tree_draft_states, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:revision, :integer, null: false, default: 0)

      add(
        :base_snapshot_id,
        references(:doc_tree_snapshots, prefix: @prefix, on_delete: :nilify_all)
      )

      add(:staged_event_count, :integer, null: false, default: 0)

      timestamps()
    end

    create_if_not_exists(unique_index(:doc_tree_draft_states, [:community_id], prefix: @prefix))

    alter table(:docs_site_states, prefix: @prefix) do
      add_if_not_exists(:draft_revision, :integer, null: false, default: 0)
      add_if_not_exists(:published_revision, :integer, null: false, default: 0)
      add_if_not_exists(:last_published_draft_revision, :integer, null: false, default: 0)
    end

    flush()

    execute("""
    INSERT INTO cms.doc_tree_draft_states (
      community_id,
      revision,
      base_snapshot_id,
      staged_event_count,
      inserted_at,
      updated_at
    )
    SELECT
      community_id,
      tree_lock_version,
      base_snapshot_id,
      staged_event_count,
      NOW(),
      NOW()
    FROM cms.docs_site_states
    ON CONFLICT (community_id) DO UPDATE
    SET
      revision = EXCLUDED.revision,
      base_snapshot_id = EXCLUDED.base_snapshot_id,
      staged_event_count = EXCLUDED.staged_event_count,
      updated_at = NOW()
    """)

    execute("""
    UPDATE cms.docs_site_states
    SET
      draft_revision = site_draft_version,
      last_published_draft_revision = published_version
    """)

    alter table(:docs_site_states, prefix: @prefix) do
      remove_if_exists(:tree_lock_version, :integer)
      remove_if_exists(:site_draft_version, :integer)
      remove_if_exists(:published_version, :integer)
      remove_if_exists(:base_snapshot_id, :bigint)
      remove_if_exists(:staged_event_count, :integer)
    end
  end
end
