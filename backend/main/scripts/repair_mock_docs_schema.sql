-- Local-only repair for groupher_server_mock docs editor schema drift.
-- Do not promote this file to a product migration.

DO $$
BEGIN
  IF to_regclass('cms.doc_tree_snapshots') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'cms'
        AND table_name = 'doc_tree_snapshots'
        AND column_name = 'revision_number'
    )
  THEN
    ALTER TABLE cms.doc_tree_snapshots
      ALTER COLUMN revision_number DROP NOT NULL;
  END IF;

  IF to_regclass('cms.publish_releases') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'cms'
        AND table_name = 'publish_releases'
        AND column_name = 'tree_json'
    )
  THEN
    ALTER TABLE cms.publish_releases
      ALTER COLUMN tree_json DROP NOT NULL;
  END IF;

  IF to_regclass('cms.publish_releases') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'cms'
        AND table_name = 'publish_releases'
        AND column_name = 'tree_hash'
    )
  THEN
    ALTER TABLE cms.publish_releases
      ALTER COLUMN tree_hash DROP NOT NULL;
  END IF;

  IF to_regclass('cms.publish_release_articles') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'cms'
        AND table_name = 'publish_release_articles'
        AND column_name = 'article_revision_id'
    )
  THEN
    ALTER TABLE cms.publish_release_articles
      ALTER COLUMN article_revision_id DROP NOT NULL;
  END IF;

  IF to_regclass('cms.doc_tree_trash_items') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'cms'
        AND table_name = 'doc_tree_trash_items'
        AND column_name = 'workspace_id'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'cms'
        AND table_name = 'doc_tree_trash_items'
        AND column_name = 'article_workspace_id'
    ) THEN
      ALTER TABLE cms.doc_tree_trash_items
        RENAME COLUMN article_workspace_id TO workspace_id;
    ELSIF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'cms'
        AND table_name = 'doc_tree_trash_items'
        AND column_name = 'workspace_id'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'cms'
        AND table_name = 'doc_tree_trash_items'
        AND column_name = 'article_version_id'
    ) THEN
      ALTER TABLE cms.doc_tree_trash_items
        RENAME COLUMN article_version_id TO workspace_id;
    END IF;

    ALTER TABLE cms.doc_tree_trash_items
      DROP CONSTRAINT IF EXISTS doc_tree_trash_items_article_workspace_id_fkey;

    ALTER TABLE cms.doc_tree_trash_items
      DROP CONSTRAINT IF EXISTS doc_tree_trash_items_article_version_id_fkey;
  END IF;

  IF to_regclass('cms.doc_tree_trash_items') IS NOT NULL
    AND to_regclass('cms.article_workspaces') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'cms'
        AND table_name = 'doc_tree_trash_items'
        AND column_name = 'workspace_id'
    )
  THEN
    UPDATE cms.doc_tree_trash_items trash
    SET workspace_id = NULL
    WHERE workspace_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM cms.article_workspaces workspace
        WHERE workspace.id = trash.workspace_id
      );

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE n.nspname = 'cms'
        AND t.relname = 'doc_tree_trash_items'
        AND c.conname = 'doc_tree_trash_items_workspace_id_fkey'
    ) THEN
      ALTER TABLE cms.doc_tree_trash_items
        ADD CONSTRAINT doc_tree_trash_items_workspace_id_fkey
        FOREIGN KEY (workspace_id)
        REFERENCES cms.article_workspaces(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END
$$;

DROP INDEX IF EXISTS cms.doc_tree_trash_items_article_workspace_id_index;
DROP INDEX IF EXISTS cms.doc_tree_trash_items_article_version_id_index;
CREATE INDEX IF NOT EXISTS doc_tree_trash_items_workspace_id_index
  ON cms.doc_tree_trash_items (workspace_id);

DELETE FROM public.schema_migrations
WHERE version IN (
  20260629194000,
  20260629195000,
  20260629195500,
  20260629200000
);
