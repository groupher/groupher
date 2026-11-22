defmodule GroupherServer.Repo.Migrations.RetireDocsLegacyModels do
  use Ecto.Migration

  @legacy ~w(doc_publics doc_draft_tags doc_revision_tags doc_drafts doc_branch_versions
    doc_branch_version_counters doc_branch_states doc_review_blocks doc_revisions
    revision_covers revision_cover_edits draft_cover_edits article_revisions
    article_body_drafts article_body_snapshots doc_branches)
  @facts ~w(article_collects article_upvotes articles_users_emotions)
  @projections for thread <- ~w(post blog changelog doc),
                   type <- ~w(reaction emotion),
                   do: "#{thread}_#{type}_infos"

  def up do
    for table <- @legacy do
      execute("""
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM cms.#{table}) THEN
          RAISE EXCEPTION 'R7 requires cleared legacy table cms.#{table}; historical conversion is not supported';
        END IF;
      END $$
      """)
    end

    execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM cms.article_asset_refs WHERE body_draft_id IS NOT NULL OR revision_id IS NOT NULL) THEN
        RAISE EXCEPTION 'R7 requires cleared legacy asset memberships';
      END IF;
    END $$
    """)

    for {schema, table, column} <-
          Enum.map(@facts ++ @projections, &{"cms", &1, "branch_id"}) ++
            [
              {"messaging", "mentions", "branch_id"},
              {"messaging", "notifications", "branch_id"},
              {"activity", "doc_logs", "branch_id"},
              {"activity", "doc_tree_logs", "branch_ref"}
            ] do
      execute("""
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM #{schema}.#{table} WHERE #{column} IS NOT NULL) THEN
          RAISE EXCEPTION 'R7 requires cleared branch-owned rows in #{schema}.#{table}';
        END IF;
      END $$
      """)

      execute("ALTER TABLE #{schema}.#{table} DROP COLUMN #{column}")
    end

    execute(
      "ALTER TABLE cms.article_asset_refs DROP COLUMN body_draft_id, DROP COLUMN revision_id"
    )

    execute(
      "ALTER TABLE cms.article_asset_refs ADD CONSTRAINT article_asset_refs_exactly_one_owner CHECK (num_nonnulls(working_copy_id, snapshot_id) = 1)"
    )

    for table <- @legacy, do: execute("DROP TABLE cms.#{table}")

    for table <- ~w(article_collects article_upvotes) do
      execute(
        "CREATE UNIQUE INDEX #{table}_user_stable_article_index ON cms.#{table}(user_id, article_id) WHERE article_id IS NOT NULL"
      )

      execute("CREATE INDEX #{table}_article_id_index ON cms.#{table}(article_id)")
    end

    execute(
      "CREATE UNIQUE INDEX articles_users_emotions_user_stable_article_emotion_index ON cms.articles_users_emotions(user_id, article_id, emotion) WHERE article_id IS NOT NULL"
    )

    execute(
      "CREATE INDEX articles_users_emotions_article_id_index ON cms.articles_users_emotions(article_id)"
    )

    for table <- @projections do
      {columns, suffix} =
        if String.contains?(table, "emotion"),
          do: {"article_id, emotion", "stable_article_emotion_index"},
          else: {"article_id", "stable_article_index"}

      execute(
        "CREATE UNIQUE INDEX #{table}_#{suffix} ON cms.#{table}(#{columns}) WHERE article_id IS NOT NULL"
      )
    end

    execute("""
    CREATE OR REPLACE FUNCTION cms.guard_doc_binding_delete() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.thread='doc' AND EXISTS (SELECT 1 FROM cms.articles WHERE id=OLD.article_id)
         AND NOT (
           EXISTS (SELECT 1 FROM cms.docs_history_owners WHERE article_id=OLD.article_id AND community_id=OLD.community_id)
           AND NOT EXISTS (SELECT 1 FROM cms.doc_lifecycles WHERE article_id=OLD.article_id)
           AND NOT EXISTS (SELECT 1 FROM cms.article_publics WHERE article_id=OLD.article_id)
           AND NOT EXISTS (SELECT 1 FROM cms.docs_queue_articles WHERE article_id=OLD.article_id)
         ) THEN
        RAISE EXCEPTION 'Doc owner can be removed only after workspace purge' USING ERRCODE='23503', CONSTRAINT='doc_owner_binding_delete_guard';
      END IF;
      RETURN OLD;
    END $$
    """)
  end

  def down do
    raise "Retired Docs models have no compatibility or historical conversion path"
  end
end
