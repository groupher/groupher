defmodule GroupherServer.Repo.Migrations.CreateDocsPublishApprovals do
  use Ecto.Migration
  @prefix "cms"

  def change do
    execute(
      "ALTER TABLE cms.docs_publish_queues DROP CONSTRAINT docs_publish_queues_unavailable_history_check",
      "ALTER TABLE cms.docs_publish_queues ADD CONSTRAINT docs_publish_queues_unavailable_history_check CHECK (public_release_id IS NULL AND latest_approval_id IS NULL)"
    )

    create(
      constraint(:docs_publish_queues, :docs_publish_queues_release_unavailable_check,
        check: "public_release_id IS NULL",
        prefix: @prefix
      )
    )

    create table(:docs_publish_approvals, primary_key: false, prefix: @prefix) do
      add(:id, :uuid, primary_key: true)
      add(:community_id, :bigint, null: false)
      add(:queue_id, :uuid, null: false)
      add(:queue_revision, :bigint, null: false)
      add(:approval_policy_revision, :bigint, null: false, default: 0)
      add(:allow_self_approval, :boolean, null: false, default: false)
      add(:base_release_id, :bigint)
      add(:plan_format_version, :integer, null: false)
      add(:hash_algorithm, :text, null: false)
      add(:plan_hash, :text, null: false)
      add(:tree_plan, :map, null: false)
      add(:sealed, :boolean, null: false, default: false)

      add(:approved_by_id, references(:users, prefix: "account", on_delete: :restrict),
        null: false
      )

      add(:approved_at, :timestamptz, null: false)
    end

    create(unique_index(:docs_publish_approvals, [:id, :community_id], prefix: @prefix))

    create(
      unique_index(:docs_publish_approvals, [:id, :queue_id, :community_id], prefix: @prefix)
    )

    create(
      constraint(:docs_publish_approvals, :docs_publish_approval_versions_check,
        check:
          "queue_revision >= 0 AND approval_policy_revision >= 0 AND plan_format_version > 0",
        prefix: @prefix
      )
    )

    create(
      constraint(:docs_publish_approvals, :docs_publish_approval_release_unavailable_check,
        check: "base_release_id IS NULL",
        prefix: @prefix
      )
    )

    execute(
      """
      ALTER TABLE cms.docs_publish_approvals ADD CONSTRAINT docs_publish_approval_queue_owner_fkey
      FOREIGN KEY (queue_id, community_id) REFERENCES cms.docs_publish_queues(id, community_id) ON DELETE RESTRICT
      """,
      "ALTER TABLE cms.docs_publish_approvals DROP CONSTRAINT docs_publish_approval_queue_owner_fkey"
    )

    execute(
      """
      ALTER TABLE cms.docs_publish_queues ADD CONSTRAINT docs_queue_approval_owner_fkey
      FOREIGN KEY (latest_approval_id, id, community_id) REFERENCES cms.docs_publish_approvals(id, queue_id, community_id) ON DELETE RESTRICT
      """,
      "ALTER TABLE cms.docs_publish_queues DROP CONSTRAINT docs_queue_approval_owner_fkey"
    )

    create table(:docs_publish_approval_articles, primary_key: false, prefix: @prefix) do
      add(
        :approval_id,
        references(:docs_publish_approvals, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:article_id, :uuid, primary_key: true)
      add(:snapshot_id, :uuid, null: false)
    end

    create(index(:docs_publish_approval_articles, [:snapshot_id], prefix: @prefix))

    execute(
      """
      ALTER TABLE cms.docs_publish_approval_articles ADD CONSTRAINT docs_approval_article_snapshot_owner_fkey
      FOREIGN KEY (article_id, snapshot_id) REFERENCES cms.article_snapshots(article_id, id) ON DELETE RESTRICT
      """,
      "ALTER TABLE cms.docs_publish_approval_articles DROP CONSTRAINT docs_approval_article_snapshot_owner_fkey"
    )

    create table(:docs_publish_approval_contributors, primary_key: false, prefix: @prefix) do
      add(
        :approval_id,
        references(:docs_publish_approvals, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:user_id, references(:users, prefix: "account", on_delete: :restrict),
        primary_key: true
      )
    end

    execute(
      """
      CREATE FUNCTION cms.docs_approval_seal_guard() RETURNS trigger AS $$
      BEGIN
        IF NOT OLD.sealed AND NEW.sealed AND (to_jsonb(OLD) - 'sealed') = (to_jsonb(NEW) - 'sealed') THEN
          RETURN NEW;
        END IF;
        RAISE EXCEPTION 'sealed approval cannot be updated' USING ERRCODE = '23514';
      END; $$ LANGUAGE plpgsql
      """,
      "DROP FUNCTION cms.docs_approval_seal_guard()"
    )

    execute(
      """
      CREATE FUNCTION cms.docs_approval_require_sealed() RETURNS trigger AS $$
      DECLARE current_seal boolean;
      BEGIN
        SELECT sealed INTO current_seal FROM cms.docs_publish_approvals WHERE id = NEW.id;
        IF current_seal IS FALSE THEN RAISE EXCEPTION 'approval must be sealed before commit' USING ERRCODE = '23514'; END IF;
        RETURN NULL;
      END; $$ LANGUAGE plpgsql
      """,
      "DROP FUNCTION cms.docs_approval_require_sealed()"
    )

    execute(
      """
      CREATE FUNCTION cms.docs_approval_member_guard() RETURNS trigger AS $$
      DECLARE parent_sealed boolean;
      BEGIN
        IF TG_OP = 'DELETE' THEN
          PERFORM 1 FROM cms.docs_publish_approvals WHERE id = OLD.approval_id;
          IF NOT FOUND THEN RETURN OLD; END IF;
          RAISE EXCEPTION 'approval member cannot be deleted alone' USING ERRCODE = '23514';
        END IF;
        IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'approval member cannot be updated' USING ERRCODE = '23514'; END IF;
        SELECT sealed INTO parent_sealed FROM cms.docs_publish_approvals WHERE id = NEW.approval_id FOR UPDATE;
        IF parent_sealed IS DISTINCT FROM FALSE THEN RAISE EXCEPTION 'approval is already sealed or absent' USING ERRCODE = '23514'; END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql
      """,
      "DROP FUNCTION cms.docs_approval_member_guard()"
    )

    execute(
      "CREATE TRIGGER docs_approval_seal_guard BEFORE UPDATE ON cms.docs_publish_approvals FOR EACH ROW EXECUTE FUNCTION cms.docs_approval_seal_guard()",
      "DROP TRIGGER docs_approval_seal_guard ON cms.docs_publish_approvals"
    )

    execute(
      "CREATE CONSTRAINT TRIGGER docs_approval_seal_required AFTER INSERT OR UPDATE ON cms.docs_publish_approvals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cms.docs_approval_require_sealed()",
      "DROP TRIGGER docs_approval_seal_required ON cms.docs_publish_approvals"
    )

    for table <- [:docs_publish_approval_articles, :docs_publish_approval_contributors] do
      execute(
        "CREATE TRIGGER #{table}_immutable BEFORE INSERT OR UPDATE OR DELETE ON cms.#{table} FOR EACH ROW EXECUTE FUNCTION cms.docs_approval_member_guard()",
        "DROP TRIGGER #{table}_immutable ON cms.#{table}"
      )
    end
  end
end
