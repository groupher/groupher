# Run only against an explicitly named, disposable B0 database.
defmodule GroupherServer.Scripts.DocsQueueB0Ddl do
  @moduledoc """
  Exercises proposed Queue, approval and Release constraints in an isolated database.

  Release and tree snapshot tables have B0-only names to avoid colliding with
  the existing branch-scoped tables in the disposable schema clone.

  Business position:

      B0 isolated database -> Ecto migration -> Queue and member constraints
  """

  use Ecto.Migration

  @prefix "cms"

  def change do
    # The real Queue migration creates the shared tables and temporarily blocks
    # history pointers; the B0-only Release and approval FKs replace that guard.
    execute(
      "ALTER TABLE cms.docs_publish_queues DROP CONSTRAINT docs_publish_queues_release_unavailable_check",
      "ALTER TABLE cms.docs_publish_queues ADD CONSTRAINT docs_publish_queues_release_unavailable_check CHECK (public_release_id IS NULL)"
    )

    # The existing DocTree event table remains in the cloned baseline. This
    # B0-only name exercises the target branch-free event constraints.
    create table(:docs_b0_tree_events, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:tree_lock_version, :bigint, null: false)
      add(:ordinal, :integer, null: false)
      add(:event_type, :text, null: false)
      add(:node_id, :text, null: false)
      add(:node_type, :text, null: false)
      add(:doc_id, :uuid)
      add(:payload, :map, null: false)
      add(:inverse_payload, :map, null: false)
      add(:actor_id, references(:users, prefix: "account", on_delete: :nilify_all))
      add(:command_id, :uuid, null: false)
      add(:reverts_event_id, :bigint)
      add(:inserted_at, :timestamptz, null: false)
    end

    create(unique_index(:docs_b0_tree_events, [:id, :community_id], prefix: @prefix))

    create(
      unique_index(:docs_b0_tree_events, [:community_id, :tree_lock_version, :ordinal],
        prefix: @prefix
      )
    )

    create(
      constraint(:docs_b0_tree_events, :docs_b0_tree_event_shape_check,
        check:
          "tree_lock_version > 0 AND ordinal >= 0 AND node_type IN ('tab','group','page','link','pin')",
        prefix: @prefix
      )
    )

    execute(
      """
      ALTER TABLE cms.docs_b0_tree_events
      ADD CONSTRAINT docs_b0_tree_event_revert_owner_fkey
      FOREIGN KEY (reverts_event_id, community_id)
      REFERENCES cms.docs_b0_tree_events(id, community_id) ON DELETE RESTRICT
      """,
      "ALTER TABLE cms.docs_b0_tree_events DROP CONSTRAINT docs_b0_tree_event_revert_owner_fkey"
    )

    execute(
      "ALTER TABLE cms.docs_queue_tree_changes DROP CONSTRAINT docs_queue_tree_changes_unavailable_event_check",
      "ALTER TABLE cms.docs_queue_tree_changes ADD CONSTRAINT docs_queue_tree_changes_unavailable_event_check CHECK (source_event_id IS NULL)"
    )

    execute(
      """
      ALTER TABLE cms.docs_queue_tree_changes
      ADD CONSTRAINT docs_b0_tree_change_event_owner_fkey
      FOREIGN KEY (source_event_id, community_id)
      REFERENCES cms.docs_b0_tree_events(id, community_id) ON DELETE RESTRICT
      """,
      "ALTER TABLE cms.docs_queue_tree_changes DROP CONSTRAINT docs_b0_tree_change_event_owner_fkey"
    )

    create table(:docs_b0_tree_snapshots, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:tree_json, :map, null: false)
      add(:created_at, :timestamptz, null: false)
    end

    create(unique_index(:docs_b0_tree_snapshots, [:id, :community_id], prefix: @prefix))

    create(
      constraint(:docs_b0_tree_snapshots, :docs_b0_tree_snapshot_v1_shape_check,
        check:
          "(jsonb_typeof(tree_json) = 'object' AND jsonb_typeof(tree_json->'version') = 'number' AND tree_json->>'version' = '1' AND jsonb_typeof(tree_json->'nodes') = 'array') IS TRUE",
        prefix: @prefix
      )
    )

    create table(:docs_b0_publish_releases, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:tree_snapshot_id, :bigint, null: false)
      add(:queue_revision, :bigint, null: false)
      add(:base_release_id, :bigint)
      add(:approval_id, :uuid)
      add(:plan_format_version, :integer, null: false)
      add(:hash_algorithm, :text, null: false)
      add(:plan_hash, :text, null: false)
      add(:sealed, :boolean, null: false, default: false)

      add(:published_by_id, references(:users, prefix: "account", on_delete: :restrict),
        null: false
      )

      add(:published_at, :timestamptz, null: false)
    end

    create(unique_index(:docs_b0_publish_releases, [:id, :community_id], prefix: @prefix))

    create(
      constraint(:docs_b0_publish_releases, :docs_b0_release_versions_check,
        check: "queue_revision >= 0 AND plan_format_version > 0",
        prefix: @prefix
      )
    )

    execute(
      """
      ALTER TABLE cms.docs_b0_publish_releases
      ADD CONSTRAINT docs_b0_release_tree_owner_fkey
      FOREIGN KEY (tree_snapshot_id, community_id)
      REFERENCES cms.docs_b0_tree_snapshots(id, community_id) ON DELETE RESTRICT
      """,
      "ALTER TABLE cms.docs_b0_publish_releases DROP CONSTRAINT docs_b0_release_tree_owner_fkey"
    )

    execute(
      """
      ALTER TABLE cms.docs_b0_publish_releases
      ADD CONSTRAINT docs_b0_release_base_owner_fkey
      FOREIGN KEY (base_release_id, community_id)
      REFERENCES cms.docs_b0_publish_releases(id, community_id) ON DELETE RESTRICT
      """,
      "ALTER TABLE cms.docs_b0_publish_releases DROP CONSTRAINT docs_b0_release_base_owner_fkey"
    )

    execute(
      """
      ALTER TABLE cms.docs_publish_queues
      ADD CONSTRAINT docs_b0_queue_public_release_owner_fkey
      FOREIGN KEY (public_release_id, community_id)
      REFERENCES cms.docs_b0_publish_releases(id, community_id) ON DELETE RESTRICT
      """,
      "ALTER TABLE cms.docs_publish_queues DROP CONSTRAINT docs_b0_queue_public_release_owner_fkey"
    )

    execute(
      "ALTER TABLE cms.docs_publish_approvals DROP CONSTRAINT docs_publish_approval_release_unavailable_check",
      "ALTER TABLE cms.docs_publish_approvals ADD CONSTRAINT docs_publish_approval_release_unavailable_check CHECK (base_release_id IS NULL)"
    )

    execute(
      """
      ALTER TABLE cms.docs_publish_approvals
      ADD CONSTRAINT docs_b0_approval_base_owner_fkey
      FOREIGN KEY (base_release_id, community_id)
      REFERENCES cms.docs_b0_publish_releases(id, community_id) ON DELETE RESTRICT
      """,
      "ALTER TABLE cms.docs_publish_approvals DROP CONSTRAINT docs_b0_approval_base_owner_fkey"
    )

    execute(
      """
      ALTER TABLE cms.docs_b0_publish_releases
      ADD CONSTRAINT docs_b0_release_approval_owner_fkey
      FOREIGN KEY (approval_id, community_id)
      REFERENCES cms.docs_publish_approvals(id, community_id) ON DELETE RESTRICT
      """,
      "ALTER TABLE cms.docs_b0_publish_releases DROP CONSTRAINT docs_b0_release_approval_owner_fkey"
    )

    create table(:docs_b0_release_articles, primary_key: false, prefix: @prefix) do
      add(
        :release_id,
        references(:docs_b0_publish_releases, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:article_id, references(:articles, type: :uuid, prefix: @prefix, on_delete: :restrict),
        primary_key: true
      )

      add(:action, :text, null: false)
      add(:snapshot_id, :uuid)
    end

    create(index(:docs_b0_release_articles, [:snapshot_id], prefix: @prefix))

    create(
      constraint(:docs_b0_release_articles, :docs_b0_release_article_action_check,
        check:
          "(action = 'publish' AND snapshot_id IS NOT NULL) OR (action = 'delete' AND snapshot_id IS NULL)",
        prefix: @prefix
      )
    )

    execute(
      """
      ALTER TABLE cms.docs_b0_release_articles
      ADD CONSTRAINT docs_b0_release_article_snapshot_owner_fkey
      FOREIGN KEY (article_id, snapshot_id)
      REFERENCES cms.article_snapshots(article_id, id) ON DELETE RESTRICT
      """,
      "ALTER TABLE cms.docs_b0_release_articles DROP CONSTRAINT docs_b0_release_article_snapshot_owner_fkey"
    )

    execute(
      """
      CREATE FUNCTION cms.docs_b0_seal_parent() RETURNS trigger AS $$
      BEGIN
        IF NOT OLD.sealed AND NEW.sealed AND
           (to_jsonb(OLD) - 'sealed') = (to_jsonb(NEW) - 'sealed') THEN
          RETURN NEW;
        END IF;
        RAISE EXCEPTION 'sealed history cannot be updated' USING ERRCODE = '23514';
      END;
      $$ LANGUAGE plpgsql
      """,
      "DROP FUNCTION cms.docs_b0_seal_parent()"
    )

    execute(
      """
      CREATE FUNCTION cms.docs_b0_require_sealed() RETURNS trigger AS $$
      DECLARE current_seal boolean;
      BEGIN
        EXECUTE format('SELECT sealed FROM %I.%I WHERE id = $1', TG_TABLE_SCHEMA, TG_TABLE_NAME)
          INTO current_seal USING NEW.id;
        IF current_seal IS FALSE THEN
          RAISE EXCEPTION 'history must be sealed before commit' USING ERRCODE = '23514';
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
      """,
      "DROP FUNCTION cms.docs_b0_require_sealed()"
    )

    execute(
      """
      CREATE FUNCTION cms.docs_b0_history_member() RETURNS trigger AS $$
      DECLARE parent_sealed boolean;
      BEGIN
        IF TG_OP = 'DELETE' THEN
          PERFORM 1 FROM cms.docs_b0_publish_releases WHERE id = OLD.release_id;
          IF NOT FOUND THEN
            RETURN OLD;
          END IF;
          RAISE EXCEPTION 'history member cannot be deleted alone' USING ERRCODE = '23514';
        END IF;
        IF TG_OP <> 'INSERT' THEN
          RAISE EXCEPTION 'history member cannot be updated' USING ERRCODE = '23514';
        END IF;
        SELECT sealed INTO parent_sealed FROM cms.docs_b0_publish_releases
        WHERE id = NEW.release_id FOR UPDATE;
        IF parent_sealed IS DISTINCT FROM FALSE THEN
          RAISE EXCEPTION 'history is already sealed or absent' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
      """,
      "DROP FUNCTION cms.docs_b0_history_member()"
    )

    execute(
      """
      CREATE FUNCTION cms.docs_b0_immutable_tree() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'tree snapshot cannot be updated' USING ERRCODE = '23514';
      END;
      $$ LANGUAGE plpgsql
      """,
      "DROP FUNCTION cms.docs_b0_immutable_tree()"
    )

    for table <- [:docs_b0_publish_releases] do
      execute(
        "CREATE TRIGGER #{table}_seal_guard BEFORE UPDATE ON cms.#{table} FOR EACH ROW EXECUTE FUNCTION cms.docs_b0_seal_parent()",
        "DROP TRIGGER #{table}_seal_guard ON cms.#{table}"
      )

      execute(
        "CREATE CONSTRAINT TRIGGER #{table}_seal_required AFTER INSERT OR UPDATE ON cms.#{table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cms.docs_b0_require_sealed()",
        "DROP TRIGGER #{table}_seal_required ON cms.#{table}"
      )
    end

    for {table, kind} <- [
          {:docs_b0_release_articles, "release"}
        ] do
      execute(
        "CREATE TRIGGER #{table}_immutable BEFORE INSERT OR UPDATE OR DELETE ON cms.#{table} FOR EACH ROW EXECUTE FUNCTION cms.docs_b0_history_member('#{kind}')",
        "DROP TRIGGER #{table}_immutable ON cms.#{table}"
      )
    end

    execute(
      "CREATE TRIGGER docs_b0_tree_immutable BEFORE UPDATE ON cms.docs_b0_tree_snapshots FOR EACH ROW EXECUTE FUNCTION cms.docs_b0_immutable_tree()",
      "DROP TRIGGER docs_b0_tree_immutable ON cms.docs_b0_tree_snapshots"
    )

    create(
      unique_index(:article_working_copies, [:article_id, :id, :scope_kind],
        name: :docs_b0_working_copy_owner_scope_index,
        prefix: @prefix
      )
    )

    create table(:docs_b0_lifecycles, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:article_id, references(:articles, type: :uuid, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:default_working_copy_id, :uuid, null: false)
      add(:default_working_copy_scope, :text, null: false, default: "default")
      add(:state, :text, null: false)
      add(:version, :bigint, null: false, default: 1)
      add(:changed_at, :timestamptz, null: false)
      add(:first_published_at, :timestamptz)
      add(:archived_at, :timestamptz)
      add(:deleted_at, :timestamptz)
      add(:destroyed_at, :timestamptz)
      timestamps()
    end

    create(unique_index(:docs_b0_lifecycles, [:article_id], prefix: @prefix))
    create(unique_index(:docs_b0_lifecycles, [:default_working_copy_id], prefix: @prefix))

    create(
      constraint(:docs_b0_lifecycles, :docs_b0_lifecycle_shape_check,
        check:
          "default_working_copy_scope = 'default' AND state IN ('draft','published','archived','deleted','destroy') AND version > 0 AND (state <> 'published' OR first_published_at IS NOT NULL)",
        prefix: @prefix
      )
    )

    execute(
      """
      ALTER TABLE cms.docs_b0_lifecycles
      ADD CONSTRAINT docs_b0_lifecycle_work_owner_fkey
      FOREIGN KEY (article_id, default_working_copy_id, default_working_copy_scope)
      REFERENCES cms.article_working_copies(article_id, id, scope_kind) ON DELETE RESTRICT ON UPDATE RESTRICT
      """,
      "ALTER TABLE cms.docs_b0_lifecycles DROP CONSTRAINT docs_b0_lifecycle_work_owner_fkey"
    )

    create table(:docs_b0_tree_nodes, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:node_id, :text, null: false)
      add(:stage, :text, null: false)
      add(:type, :text, null: false)
      add(:parent_node_id, :text)
      add(:doc_id, references(:articles, type: :uuid, prefix: @prefix, on_delete: :restrict))
      add(:title, :text)
      add(:index, :integer, null: false, default: 0)
      add(:href, :text)
      add(:marker, :map)
      add(:badge, :text)
      add(:hidden, :boolean, null: false, default: false)
      timestamps()
    end

    create(unique_index(:docs_b0_tree_nodes, [:community_id, :stage, :node_id], prefix: @prefix))

    create(
      unique_index(:docs_b0_tree_nodes, [:community_id, :stage, :doc_id],
        prefix: @prefix,
        where: "type = 'page' AND doc_id IS NOT NULL"
      )
    )

    create(
      unique_index(:docs_b0_tree_nodes, [:community_id, :stage, :index],
        prefix: @prefix,
        where: "type = 'tab' AND parent_node_id IS NULL",
        name: :docs_b0_tree_root_index
      )
    )

    create(
      unique_index(:docs_b0_tree_nodes, [:community_id, :stage, :parent_node_id, :index],
        prefix: @prefix,
        where: "type IN ('group','page','link')",
        name: :docs_b0_tree_navigation_index
      )
    )

    create(
      unique_index(:docs_b0_tree_nodes, [:community_id, :stage, :parent_node_id, :index],
        prefix: @prefix,
        where: "type = 'pin'",
        name: :docs_b0_tree_pin_index
      )
    )

    create(
      unique_index(:docs_b0_tree_nodes, [:community_id, :stage, :title],
        prefix: @prefix,
        where: "type = 'tab' AND parent_node_id IS NULL",
        name: :docs_b0_tree_root_title
      )
    )

    create(
      unique_index(:docs_b0_tree_nodes, [:community_id, :stage, :parent_node_id, :title],
        prefix: @prefix,
        where: "type IN ('group','page','link')",
        name: :docs_b0_tree_navigation_title
      )
    )

    create(
      constraint(:docs_b0_tree_nodes, :docs_b0_node_shape_check,
        check:
          "stage IN ('draft','public') AND ((type = 'tab' AND parent_node_id IS NULL AND doc_id IS NULL AND href IS NULL) OR (type = 'group' AND parent_node_id IS NOT NULL AND doc_id IS NULL AND href IS NULL) OR (type = 'page' AND parent_node_id IS NOT NULL AND doc_id IS NOT NULL AND href IS NULL) OR (type IN ('link','pin') AND parent_node_id IS NOT NULL AND doc_id IS NULL AND href IS NOT NULL))",
        prefix: @prefix
      )
    )

    execute(
      """
      ALTER TABLE cms.docs_b0_tree_nodes
      ADD CONSTRAINT docs_b0_node_parent_fkey
      FOREIGN KEY (community_id, stage, parent_node_id)
      REFERENCES cms.docs_b0_tree_nodes(community_id, stage, node_id)
      DEFERRABLE INITIALLY DEFERRED
      """,
      "ALTER TABLE cms.docs_b0_tree_nodes DROP CONSTRAINT docs_b0_node_parent_fkey"
    )

    create(
      unique_index(:trash_actions, [:id, :community_id],
        prefix: @prefix,
        name: :docs_b0_trash_action_owner_index
      )
    )

    create table(:docs_b0_trashed_docs, prefix: @prefix) do
      add(:hash_id, :uuid, null: false)
      add(:trash_action_id, :bigint, null: false)

      add(:community_id, references(:communities, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:article_id, references(:articles, type: :uuid, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:restore_state, :text, null: false)
      add(:deleted_by_id, references(:users, prefix: "account", on_delete: :nilify_all))
      add(:deleted_at, :timestamptz, null: false)
      timestamps()
    end

    create(unique_index(:docs_b0_trashed_docs, [:hash_id], prefix: @prefix))
    create(unique_index(:docs_b0_trashed_docs, [:article_id], prefix: @prefix))
    create(index(:docs_b0_trashed_docs, [:trash_action_id], prefix: @prefix))

    create(
      constraint(:docs_b0_trashed_docs, :docs_b0_trashed_doc_state_check,
        check: "restore_state IN ('draft','published','archived')",
        prefix: @prefix
      )
    )

    execute(
      """
      ALTER TABLE cms.docs_b0_trashed_docs
      ADD CONSTRAINT docs_b0_trashed_doc_action_owner_fkey
      FOREIGN KEY (trash_action_id, community_id)
      REFERENCES cms.trash_actions(id, community_id) ON DELETE RESTRICT
      """,
      "ALTER TABLE cms.docs_b0_trashed_docs DROP CONSTRAINT docs_b0_trashed_doc_action_owner_fkey"
    )

    create table(:docs_b0_trashed_nodes, prefix: @prefix) do
      add(:hash_id, :uuid, null: false)
      add(:trash_action_id, :bigint, null: false)

      add(:community_id, references(:communities, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:node_id, :text, null: false)
      add(:doc_id, references(:articles, type: :uuid, prefix: @prefix, on_delete: :restrict))
      add(:type, :text, null: false)
      add(:draft_snapshot, :map)
      add(:public_snapshot, :map)
      add(:deleted_by_id, references(:users, prefix: "account", on_delete: :nilify_all))
      add(:deleted_at, :timestamptz, null: false)
      timestamps()
    end

    create(unique_index(:docs_b0_trashed_nodes, [:hash_id], prefix: @prefix))
    create(unique_index(:docs_b0_trashed_nodes, [:trash_action_id, :node_id], prefix: @prefix))
    create(index(:docs_b0_trashed_nodes, [:community_id, :deleted_at], prefix: @prefix))

    create(
      constraint(:docs_b0_trashed_nodes, :docs_b0_trashed_node_shape_check,
        check:
          "type IN ('tab','group','page','link','pin') AND (draft_snapshot IS NOT NULL OR public_snapshot IS NOT NULL)",
        prefix: @prefix
      )
    )

    execute(
      """
      ALTER TABLE cms.docs_b0_trashed_nodes
      ADD CONSTRAINT docs_b0_trashed_node_action_owner_fkey
      FOREIGN KEY (trash_action_id, community_id)
      REFERENCES cms.trash_actions(id, community_id) ON DELETE RESTRICT
      """,
      "ALTER TABLE cms.docs_b0_trashed_nodes DROP CONSTRAINT docs_b0_trashed_node_action_owner_fkey"
    )
  end
end

alias GroupherServer.Repo

[[database]] = Repo.query!("SELECT current_database()").rows
expected = System.get_env("DOCS_B0_DISPOSABLE_DATABASE")

unless Mix.env() == :test and is_binary(expected) and expected == database and
         String.starts_with?(database, "groupher_docs_b0_") do
  raise "B0 DDL exercise requires an explicitly named disposable test database"
end

Ecto.Migrator.up(Repo, 20_991_111_000_000, GroupherServer.Scripts.DocsQueueB0Ddl, log: false)
IO.puts("DOCS_B0_QUEUE_DDL_APPLIED=#{database}")
