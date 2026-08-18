defmodule GroupherServer.Repo.Migrations.SplitArticleCoreAndDocs do
  use Ecto.Migration

  @prefix "cms"

  @ordinary_tables ~w(posts blogs changelogs)
  @doc_branch_tables ~w(docs doc_tree_nodes doc_tree_events doc_tree_snapshots docs_site_states
                         doc_publish_releases trashed_doc_tree_nodes)

  def up do
    create_doc_branches()
    copy_doc_branches()
    create_doc_lifecycles()
    create_doc_snapshots()
    create_trashed_doc_articles()

    Enum.each(@ordinary_tables, &simplify_article_table/1)
    Enum.each(@doc_branch_tables, &move_branch_fk/1)

    drop_doc_article_trash_rows()
    drop_old_snapshot_membership_fk()
    drop_old_snapshot_table()
    drop_old_article_branch_table()
    constrain_article_lifecycle_threads()
  end

  def down do
    raise "SplitArticleCoreAndDocs is intentionally irreversible"
  end

  defp create_doc_branches do
    execute("""
    CREATE TABLE #{@prefix}.doc_branches (
      id BIGSERIAL PRIMARY KEY,
      community_id BIGINT NOT NULL REFERENCES #{@prefix}.communities(id) ON DELETE CASCADE,
      source_branch_id BIGINT REFERENCES #{@prefix}.doc_branches(id) ON DELETE SET NULL,
      created_by_id BIGINT REFERENCES account.users(id) ON DELETE SET NULL,
      slug VARCHAR(80) NOT NULL,
      title VARCHAR(100) NOT NULL,
      type VARCHAR(20) NOT NULL,
      status VARCHAR(20) NOT NULL,
      inserted_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      CONSTRAINT doc_branches_type_check CHECK (type IN ('main', 'preview')),
      CONSTRAINT doc_branches_status_check CHECK (status IN ('active', 'archived'))
    );
    """)

    execute("""
    CREATE UNIQUE INDEX doc_branches_community_slug_index
      ON #{@prefix}.doc_branches (community_id, slug);
    """)

    execute("""
    CREATE UNIQUE INDEX doc_branches_main_index
      ON #{@prefix}.doc_branches (community_id)
      WHERE type = 'main';
    """)

    execute("""
    CREATE INDEX doc_branches_source_branch_id_index
      ON #{@prefix}.doc_branches (source_branch_id);
    """)
  end

  defp copy_doc_branches do
    execute("""
    INSERT INTO #{@prefix}.doc_branches
      (id, community_id, source_branch_id, created_by_id, slug, title, type, status,
       inserted_at, updated_at)
    SELECT id, community_id, source_branch_id, created_by_id, slug, title, type, status,
           inserted_at, updated_at
    FROM #{@prefix}.article_branches
    WHERE thread = 'doc';
    """)

    execute("""
    SELECT setval(
      pg_get_serial_sequence('#{@prefix}.doc_branches', 'id'),
      COALESCE((SELECT MAX(id) FROM #{@prefix}.doc_branches), 1),
      true
    );
    """)
  end

  defp create_doc_lifecycles do
    execute("""
    CREATE TABLE #{@prefix}.doc_lifecycles (
      id BIGSERIAL PRIMARY KEY,
      community_id BIGINT NOT NULL REFERENCES #{@prefix}.communities(id) ON DELETE CASCADE,
      branch_id BIGINT NOT NULL REFERENCES #{@prefix}.doc_branches(id) ON DELETE CASCADE,
      article_hash_id UUID NOT NULL,
      state VARCHAR(20) NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      changed_at TIMESTAMPTZ NOT NULL,
      archived_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ,
      destroyed_at TIMESTAMPTZ,
      inserted_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      CONSTRAINT doc_lifecycles_state_check
        CHECK (state IN ('draft_only', 'published', 'archived', 'deleted', 'destroy'))
    );
    """)

    execute("""
    CREATE UNIQUE INDEX doc_lifecycles_identity_index
      ON #{@prefix}.doc_lifecycles (community_id, branch_id, article_hash_id);
    """)

    execute("""
    CREATE INDEX doc_lifecycles_branch_state_index
      ON #{@prefix}.doc_lifecycles (community_id, branch_id, state);
    """)
  end

  defp create_doc_snapshots do
    execute("""
    CREATE TABLE #{@prefix}.doc_snapshots (
      id BIGSERIAL PRIMARY KEY,
      community_id BIGINT NOT NULL REFERENCES #{@prefix}.communities(id) ON DELETE CASCADE,
      branch_id BIGINT NOT NULL REFERENCES #{@prefix}.doc_branches(id) ON DELETE CASCADE,
      parent_snapshot_id BIGINT REFERENCES #{@prefix}.doc_snapshots(id) ON DELETE SET NULL,
      source_snapshot_id BIGINT REFERENCES #{@prefix}.doc_snapshots(id) ON DELETE SET NULL,
      author_id BIGINT REFERENCES #{@prefix}.authors(id) ON DELETE SET NULL,
      hash_id UUID NOT NULL DEFAULT gen_random_uuid(),
      article_hash_id UUID NOT NULL,
      stage VARCHAR(20) NOT NULL,
      action VARCHAR(20) NOT NULL,
      title VARCHAR(100) NOT NULL,
      slug VARCHAR(255),
      subtitle VARCHAR(240),
      digest TEXT,
      document_json TEXT NOT NULL,
      body_bag JSONB NOT NULL,
      data JSONB NOT NULL DEFAULT '{}',
      version_hash VARCHAR(255) NOT NULL,
      revision_number INTEGER NOT NULL,
      schema_version INTEGER NOT NULL DEFAULT 1,
      message TEXT,
      inserted_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      CONSTRAINT doc_snapshots_stage_check CHECK (stage IN ('draft', 'public')),
      CONSTRAINT doc_snapshots_action_check
        CHECK (action IN ('checkpoint', 'publish', 'fork', 'promote', 'restore'))
    );
    """)

    execute("""
    CREATE UNIQUE INDEX doc_snapshots_hash_id_index
      ON #{@prefix}.doc_snapshots (hash_id);
    """)

    execute("""
    CREATE UNIQUE INDEX doc_snapshots_revision_index
      ON #{@prefix}.doc_snapshots (branch_id, article_hash_id, revision_number);
    """)

    execute("""
    CREATE INDEX doc_snapshots_article_hash_id_index
      ON #{@prefix}.doc_snapshots (article_hash_id);
    """)
  end

  defp create_trashed_doc_articles do
    execute("""
    CREATE TABLE #{@prefix}.trashed_doc_articles (
      id BIGSERIAL PRIMARY KEY,
      hash_id UUID NOT NULL DEFAULT gen_random_uuid(),
      trash_action_id BIGINT NOT NULL REFERENCES #{@prefix}.trash_actions(id) ON DELETE RESTRICT,
      community_id BIGINT NOT NULL REFERENCES #{@prefix}.communities(id) ON DELETE CASCADE,
      branch_id BIGINT NOT NULL REFERENCES #{@prefix}.doc_branches(id) ON DELETE CASCADE,
      article_hash_id UUID NOT NULL,
      restore_state VARCHAR(20) NOT NULL,
      deleted_by_id BIGINT REFERENCES account.users(id) ON DELETE SET NULL,
      deleted_at TIMESTAMPTZ NOT NULL,
      inserted_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      CONSTRAINT trashed_doc_articles_restore_state_check
        CHECK (restore_state IN ('draft_only', 'published', 'archived'))
    );
    """)

    execute("""
    CREATE UNIQUE INDEX trashed_doc_articles_hash_id_index
      ON #{@prefix}.trashed_doc_articles (hash_id);
    """)

    execute("""
    CREATE UNIQUE INDEX trashed_doc_articles_identity_index
      ON #{@prefix}.trashed_doc_articles (community_id, branch_id, article_hash_id);
    """)

    execute("""
    CREATE INDEX trashed_doc_articles_action_index
      ON #{@prefix}.trashed_doc_articles (trash_action_id);
    """)
  end

  defp simplify_article_table(table) do
    execute("ALTER TABLE #{@prefix}.#{table} DROP CONSTRAINT IF EXISTS #{table}_branch_id_fkey;")
    execute("DROP INDEX IF EXISTS #{@prefix}.#{table}_branch_article_hash_stage_index;")
    execute("ALTER TABLE #{@prefix}.#{table} DROP COLUMN IF EXISTS branch_id;")

    execute("""
    CREATE UNIQUE INDEX #{table}_community_article_hash_stage_index
      ON #{@prefix}.#{table} (community_id, article_hash_id, stage);
    """)
  end

  defp move_branch_fk(table) do
    execute("ALTER TABLE #{@prefix}.#{table} DROP CONSTRAINT IF EXISTS #{table}_branch_id_fkey;")
    execute("""
    ALTER TABLE #{@prefix}.#{table}
      ADD CONSTRAINT #{table}_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES #{@prefix}.doc_branches(id) ON DELETE CASCADE;
    """)
  end

  defp drop_doc_article_trash_rows do
    execute("DELETE FROM #{@prefix}.trashed_articles WHERE thread = 'doc';")
    execute("ALTER TABLE #{@prefix}.trashed_articles DROP CONSTRAINT IF EXISTS trashed_articles_thread_check;")
    execute("""
    ALTER TABLE #{@prefix}.trashed_articles
      ADD CONSTRAINT trashed_articles_thread_check
      CHECK (thread IN ('post', 'blog', 'changelog'));
    """)
  end

  defp drop_old_snapshot_membership_fk do
    execute("""
    ALTER TABLE #{@prefix}.doc_publish_release_articles
      DROP CONSTRAINT IF EXISTS doc_publish_release_articles_snapshot_id_fkey;
    """)

    execute("""
    ALTER TABLE #{@prefix}.doc_publish_release_articles
      ADD CONSTRAINT doc_publish_release_articles_snapshot_id_fkey
      FOREIGN KEY (snapshot_id) REFERENCES #{@prefix}.doc_snapshots(id) ON DELETE RESTRICT;
    """)
  end

  defp drop_old_snapshot_table do
    execute("DROP TABLE IF EXISTS #{@prefix}.article_snapshots CASCADE;")
  end

  defp drop_old_article_branch_table do
    execute("DROP TABLE IF EXISTS #{@prefix}.article_branches CASCADE;")
  end

  defp constrain_article_lifecycle_threads do
    execute("DELETE FROM #{@prefix}.article_lifecycles WHERE thread = 'doc';")

    execute("""
    ALTER TABLE #{@prefix}.article_lifecycles
      DROP CONSTRAINT IF EXISTS article_lifecycles_thread_check;
    """)

    execute("""
    ALTER TABLE #{@prefix}.article_lifecycles
      ADD CONSTRAINT article_lifecycles_thread_check
      CHECK (thread IN ('post', 'blog', 'changelog'));
    """)
  end
end
