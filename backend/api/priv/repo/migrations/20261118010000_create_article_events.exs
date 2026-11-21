defmodule GroupherServer.Repo.Migrations.CreateArticleEvents do
  use Ecto.Migration

  @prefix "cms"

  def change do
    execute(
      "ALTER TABLE cms.article_snapshots ALTER COLUMN captured_by_id DROP NOT NULL",
      "ALTER TABLE cms.article_snapshots ALTER COLUMN captured_by_id SET NOT NULL"
    )

    alter table(:article_snapshots, prefix: @prefix) do
      add(:capture_actor_type, :text, null: false, default: "user")
    end

    create(
      constraint(:article_snapshots, :article_snapshots_capture_actor_check,
        prefix: @prefix,
        check:
          "(capture_actor_type = 'user' AND captured_by_id IS NOT NULL) OR (capture_actor_type = 'system' AND captured_by_id IS NULL)"
      )
    )

    execute(
      """
      CREATE OR REPLACE FUNCTION cms.guard_doc_binding_delete() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.thread='doc' AND EXISTS (SELECT 1 FROM cms.articles WHERE id=OLD.article_id)
           AND NOT EXISTS (
             SELECT 1 FROM cms.article_history_owners
             WHERE article_id=OLD.article_id AND community_id=OLD.community_id
           ) AND NOT EXISTS (
             SELECT 1 FROM cms.community_lifecycles
             WHERE community_id=OLD.community_id AND state='destroy'
           ) THEN
          RAISE EXCEPTION 'Doc binding can be removed only after history ownership is retained' USING ERRCODE='23503', CONSTRAINT='doc_owner_binding_delete_guard';
        END IF;
        RETURN OLD;
      END $$
      """,
      """
      CREATE OR REPLACE FUNCTION cms.guard_doc_binding_delete() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.thread='doc' AND EXISTS (SELECT 1 FROM cms.articles WHERE id=OLD.article_id)
           AND NOT EXISTS (
             SELECT 1 FROM cms.article_history_owners
             WHERE article_id=OLD.article_id AND community_id=OLD.community_id
           ) THEN
          RAISE EXCEPTION 'Doc binding can be removed only after history ownership is retained' USING ERRCODE='23503', CONSTRAINT='doc_owner_binding_delete_guard';
        END IF;
        RETURN OLD;
      END $$
      """
    )

    execute(
      """
      CREATE OR REPLACE FUNCTION cms.require_doc_owner_at_commit() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE target_id uuid; target_thread text;
      BEGIN
        IF TG_TABLE_NAME='article_bindings' AND TG_OP='DELETE' THEN RETURN NULL; END IF;
        IF TG_TABLE_NAME='articles' THEN target_id := NEW.id;
        ELSE target_id := NEW.article_id;
        END IF;
        SELECT thread INTO target_thread FROM cms.articles WHERE id=target_id FOR UPDATE;
        IF target_thread='doc' AND NOT EXISTS (
          SELECT 1 FROM cms.article_bindings WHERE article_id=target_id AND thread='doc'
        ) AND NOT EXISTS (
          SELECT 1 FROM cms.article_history_owners WHERE article_id=target_id
        ) THEN
          RAISE EXCEPTION 'Doc requires an active binding or retained history ownership'
            USING ERRCODE='23514', CONSTRAINT='doc_owner_required_at_commit';
        END IF;
        RETURN NULL;
      END $$
      """,
      """
      CREATE OR REPLACE FUNCTION cms.require_doc_owner_at_commit() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE target_id uuid; target_thread text;
      BEGIN
        IF TG_TABLE_NAME='articles' THEN target_id := NEW.id;
        ELSIF TG_OP='DELETE' THEN target_id := OLD.article_id;
        ELSE target_id := NEW.article_id;
        END IF;
        SELECT thread INTO target_thread FROM cms.articles WHERE id=target_id FOR UPDATE;
        IF target_thread='doc' AND NOT EXISTS (
          SELECT 1 FROM cms.article_bindings WHERE article_id=target_id AND thread='doc'
        ) AND NOT EXISTS (
          SELECT 1 FROM cms.article_history_owners WHERE article_id=target_id
        ) THEN
          RAISE EXCEPTION 'Doc requires an active binding or retained history ownership'
            USING ERRCODE='23514', CONSTRAINT='doc_owner_required_at_commit';
        END IF;
        RETURN NULL;
      END $$
      """
    )

    create table(:article_events, primary_key: false, prefix: @prefix) do
      add(:id, :uuid, primary_key: true)

      add(:article_id, references(:articles, type: :uuid, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:sequence, :bigint, null: false)
      add(:actor_type, :text, null: false)
      add(:actor_id, references(:users, prefix: "account", on_delete: :restrict))
      add(:source, :text, null: false)
      add(:service_ref, :text)
      add(:actor_snapshot, :map, null: false)
      add(:occurred_at, :timestamptz, null: false)
      add(:operation_ref, :uuid, null: false)
      add(:operation_index, :integer, null: false, default: 0)
      add(:type, :text, null: false)
      add(:working_copy_id, :uuid)
      add(:before_revision, :bigint)
      add(:after_revision, :bigint)
      add(:before_snapshot_id, :uuid)
      add(:after_snapshot_id, :uuid, null: false)
      add(:source_snapshot_id, :uuid)
      add(:previous_event_id, :uuid)
      add(:source_community_id, references(:communities, prefix: @prefix, on_delete: :nilify_all))
      timestamps(updated_at: false)
    end

    create(unique_index(:article_events, [:article_id, :id], prefix: @prefix))
    create(unique_index(:article_events, [:article_id, :sequence], prefix: @prefix))
    create(unique_index(:article_events, [:operation_ref, :operation_index], prefix: @prefix))

    execute(
      "CREATE INDEX article_events_sequence_desc_index ON cms.article_events (article_id, sequence DESC)",
      "DROP INDEX cms.article_events_sequence_desc_index"
    )

    for field <- [:before_snapshot_id, :after_snapshot_id, :source_snapshot_id] do
      execute(
        "ALTER TABLE cms.article_events ADD CONSTRAINT article_events_#{field}_owner_fkey " <>
          "FOREIGN KEY (article_id, #{field}) REFERENCES cms.article_snapshots(article_id, id) ON DELETE RESTRICT",
        "ALTER TABLE cms.article_events DROP CONSTRAINT article_events_#{field}_owner_fkey"
      )
    end

    execute(
      "ALTER TABLE cms.article_events ADD CONSTRAINT article_events_previous_owner_fkey " <>
        "FOREIGN KEY (article_id, previous_event_id) REFERENCES cms.article_events(article_id, id) ON DELETE RESTRICT",
      "ALTER TABLE cms.article_events DROP CONSTRAINT article_events_previous_owner_fkey"
    )

    execute(
      """
      CREATE FUNCTION cms.reject_article_event_update() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF pg_trigger_depth() > 1 AND OLD.source_community_id IS NOT NULL
           AND NEW.source_community_id IS NULL
           AND (to_jsonb(NEW) - 'source_community_id') = (to_jsonb(OLD) - 'source_community_id') THEN
          RETURN NEW;
        END IF;
        RAISE EXCEPTION 'article events are immutable' USING ERRCODE = '55000';
      END;
      $$
      """,
      "DROP FUNCTION cms.reject_article_event_update()"
    )

    execute(
      "CREATE TRIGGER article_events_immutable BEFORE UPDATE ON cms.article_events FOR EACH ROW EXECUTE FUNCTION cms.reject_article_event_update()",
      "DROP TRIGGER article_events_immutable ON cms.article_events"
    )

    create(
      constraint(:article_events, :article_events_sequence_check,
        prefix: @prefix,
        check: "sequence > 0 AND operation_index >= 0"
      )
    )

    create(
      constraint(:article_events, :article_events_actor_check,
        prefix: @prefix,
        check:
          "(actor_type = 'user' AND actor_id IS NOT NULL) OR (actor_type = 'system' AND actor_id IS NULL)"
      )
    )

    create(
      constraint(:article_events, :article_events_source_check,
        prefix: @prefix,
        check: "source IN ('browser', 'import', 'system')"
      )
    )

    create(
      constraint(:article_events, :article_events_type_check,
        prefix: @prefix,
        check: "type IN ('create', 'edit', 'restore', 'fork', 'publish')"
      )
    )

    create(
      constraint(:article_events, :article_events_revision_check,
        prefix: @prefix,
        check:
          "(before_revision IS NULL OR before_revision > 0) AND (after_revision IS NULL OR after_revision > 0)"
      )
    )

    create(
      constraint(:article_events, :article_events_shape_check,
        prefix: @prefix,
        check:
          "(type = 'publish' AND previous_event_id IS NULL) OR (type = 'create' AND working_copy_id IS NOT NULL AND after_revision IS NOT NULL) OR (type = 'fork' AND working_copy_id IS NOT NULL AND after_revision IS NOT NULL AND source_snapshot_id IS NOT NULL) OR (type IN ('edit', 'restore') AND working_copy_id IS NOT NULL AND before_revision IS NOT NULL AND after_revision IS NOT NULL AND after_revision > before_revision AND before_snapshot_id IS NOT NULL AND (type <> 'restore' OR source_snapshot_id IS NOT NULL))"
      )
    )
  end
end
