defmodule GroupherServer.Repo.Migrations.CreateTicketDomain do
  use Ecto.Migration

  @cms "cms"
  @account "account"

  def up do
    execute("ALTER TABLE #{@cms}.articles DROP CONSTRAINT articles_thread_check")

    create(
      constraint(:articles, :articles_thread_check,
        prefix: @cms,
        check: "thread IN ('post', 'blog', 'changelog', 'doc', 'ticket')"
      )
    )

    create(
      unique_index(:article_bindings, [:article_id, :id],
        prefix: @cms,
        name: :article_bindings_article_id_id_index
      )
    )

    create(
      unique_index(:article_revisions, [:article_id, :id],
        prefix: @cms,
        name: :article_revisions_article_id_id_index
      )
    )

    execute(
      "CREATE INDEX article_revisions_ticket_title_prefix_index " <>
        "ON #{@cms}.article_revisions (lower(title) text_pattern_ops, article_id)"
    )

    create table(:ticket_states, primary_key: false, prefix: @cms) do
      add(:article_id, references(:articles, type: :uuid, prefix: @cms, on_delete: :delete_all),
        primary_key: true
      )

      add(:article_binding_id, :bigint, null: false)
      add(:current_revision_id, :uuid, null: false)
      add(:type, :string, null: false)
      add(:status, :string, null: false)
      add(:public_visibility, :string, null: false)
      add(:priority, :smallint, null: false, default: 1)
      add(:planned_start_at, :timestamptz)
      add(:planned_end_at, :timestamptz)
      add(:started_at, :timestamptz)
      add(:completed_at, :timestamptz)
      add(:rank, :bigint, null: false, default: 0)
      add(:version, :bigint, null: false, default: 1)
      timestamps()
    end

    execute("""
    ALTER TABLE #{@cms}.ticket_states
      ADD CONSTRAINT ticket_states_article_binding_fkey
      FOREIGN KEY (article_id, article_binding_id)
      REFERENCES #{@cms}.article_bindings (article_id, id) ON DELETE CASCADE,
      ADD CONSTRAINT ticket_states_current_revision_fkey
      FOREIGN KEY (article_id, current_revision_id)
      REFERENCES #{@cms}.article_revisions (article_id, id) ON DELETE RESTRICT
    """)

    create(
      constraint(:ticket_states, :ticket_states_type_status_check,
        prefix: @cms,
        check:
          "(type = 'user' AND status IN ('todo', 'wip', 'done')) OR " <>
            "(type = 'worker' AND status IN ('todo', 'wip', 'done')) OR " <>
            "(type = 'case' AND status IN ('open', 'resolved'))"
      )
    )

    create(
      constraint(:ticket_states, :ticket_states_type_visibility_check,
        prefix: @cms,
        check:
          "(type = 'user' AND public_visibility IN ('published', 'held')) OR " <>
            "(type IN ('worker', 'case') AND public_visibility = 'internal')"
      )
    )

    create(
      constraint(:ticket_states, :ticket_states_priority_check,
        prefix: @cms,
        check: "priority BETWEEN 0 AND 3"
      )
    )

    create(
      constraint(:ticket_states, :ticket_states_version_check, prefix: @cms, check: "version > 0")
    )

    create(
      constraint(:ticket_states, :ticket_states_planned_window_check,
        prefix: @cms,
        check:
          "planned_start_at IS NULL OR planned_end_at IS NULL OR planned_start_at <= planned_end_at"
      )
    )

    create(
      index(:ticket_states, [:type, :status, :rank, :article_id],
        prefix: @cms,
        name: :ticket_states_type_status_rank_index
      )
    )

    create(
      index(:ticket_states, [:planned_start_at, :planned_end_at],
        prefix: @cms,
        name: :ticket_states_planned_window_index
      )
    )

    create table(:ticket_posts, primary_key: false, prefix: @cms) do
      add(:id, :uuid, primary_key: true)

      add(:ticket_id, references(:articles, type: :uuid, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      add(:post_id, references(:articles, type: :uuid, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      timestamps()
    end

    create(
      unique_index(:ticket_posts, [:ticket_id, :post_id],
        prefix: @cms,
        name: :ticket_posts_ticket_post_index
      )
    )

    create(
      index(:ticket_posts, [:post_id, :ticket_id],
        prefix: @cms,
        name: :ticket_posts_post_ticket_index
      )
    )

    create table(:ticket_workers, primary_key: false, prefix: @cms) do
      add(:id, :uuid, primary_key: true)

      add(
        :parent_ticket_id,
        references(:articles, type: :uuid, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      add(
        :worker_ticket_id,
        references(:articles, type: :uuid, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      timestamps()
    end

    create(
      unique_index(:ticket_workers, [:worker_ticket_id],
        prefix: @cms,
        name: :ticket_workers_worker_ticket_index
      )
    )

    create(
      unique_index(:ticket_workers, [:parent_ticket_id, :worker_ticket_id],
        prefix: @cms,
        name: :ticket_workers_parent_worker_index
      )
    )

    create table(:ticket_case_members, primary_key: false, prefix: @cms) do
      add(:id, :uuid, primary_key: true)

      add(
        :case_ticket_id,
        references(:articles, type: :uuid, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      add(
        :user_ticket_id,
        references(:articles, type: :uuid, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      timestamps()
    end

    create(
      unique_index(:ticket_case_members, [:case_ticket_id, :user_ticket_id],
        prefix: @cms,
        name: :ticket_case_members_case_user_index
      )
    )

    create table(:ticket_case_workers, primary_key: false, prefix: @cms) do
      add(:id, :uuid, primary_key: true)

      add(
        :case_ticket_id,
        references(:articles, type: :uuid, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      add(
        :worker_ticket_id,
        references(:articles, type: :uuid, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      timestamps()
    end

    create(
      unique_index(:ticket_case_workers, [:case_ticket_id, :worker_ticket_id],
        prefix: @cms,
        name: :ticket_case_workers_case_worker_index
      )
    )

    create table(:ticket_assignees, primary_key: false, prefix: @cms) do
      add(:id, :uuid, primary_key: true)

      add(:ticket_id, references(:articles, type: :uuid, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      add(:user_id, references(:users, prefix: @account, on_delete: :delete_all), null: false)
      timestamps()
    end

    create(
      unique_index(:ticket_assignees, [:ticket_id, :user_id],
        prefix: @cms,
        name: :ticket_assignees_ticket_user_index
      )
    )

    create(
      index(:ticket_assignees, [:user_id, :ticket_id],
        prefix: @cms,
        name: :ticket_assignees_user_ticket_index
      )
    )

    create table(:ticket_tags, primary_key: false, prefix: @cms) do
      add(:id, :uuid, primary_key: true)

      add(:ticket_id, references(:articles, type: :uuid, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      add(:community_tag_id, references(:community_tags, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      timestamps()
    end

    create(
      unique_index(:ticket_tags, [:ticket_id, :community_tag_id],
        prefix: @cms,
        name: :ticket_tags_ticket_tag_index
      )
    )

    create table(:ticket_facets, primary_key: false, prefix: @cms) do
      add(:id, :uuid, primary_key: true)

      add(:ticket_id, references(:articles, type: :uuid, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      add(:key, :string, null: false)
      add(:value, :string, null: false)
      timestamps()

      constraint(:ticket_facets, :ticket_facets_key_check,
        check: "key IN ('version', 'os', 'module')"
      )
    end

    create(
      unique_index(:ticket_facets, [:ticket_id, :key, :value],
        prefix: @cms,
        name: :ticket_facets_ticket_key_value_index
      )
    )

    create(
      index(:ticket_facets, [:key, :value, :ticket_id],
        prefix: @cms,
        name: :ticket_facets_filter_index
      )
    )

    create table(:ticket_events, primary_key: false, prefix: @cms) do
      add(:id, :uuid, primary_key: true)

      add(:ticket_id, references(:articles, type: :uuid, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      add(:event_type, :string, null: false)
      add(:from_status, :string)
      add(:to_status, :string)
      add(:from_visibility, :string)
      add(:to_visibility, :string)
      add(:reason, :text)
      add(:actor_id, references(:users, prefix: @account, on_delete: :restrict))
      add(:source_kind, :string)
      add(:source_id, :string)
      add(:command_id, :uuid, null: false)
      add(:occurred_at, :timestamptz, null: false)
      timestamps(updated_at: false)

      constraint(:ticket_events, :ticket_events_payload_check,
        check:
          "(event_type = 'work_status' AND to_status IS NOT NULL AND from_visibility IS NULL AND to_visibility IS NULL) OR " <>
            "(event_type = 'visibility' AND from_status IS NULL AND to_status IS NULL AND from_visibility IS NOT NULL AND to_visibility IS NOT NULL AND reason IS NOT NULL AND length(trim(reason)) > 0)"
      )

      constraint(:ticket_events, :ticket_events_source_check,
        check:
          "(actor_id IS NOT NULL) OR (length(trim(source_kind)) > 0 AND length(trim(source_id)) > 0)"
      )
    end

    create(
      unique_index(:ticket_events, [:ticket_id, :command_id],
        prefix: @cms,
        name: :ticket_events_ticket_command_index
      )
    )

    create(
      unique_index(:ticket_events, [:ticket_id, :id],
        prefix: @cms,
        name: :ticket_events_ticket_id_index
      )
    )

    create(
      index(:ticket_events, [:ticket_id, :occurred_at, :id],
        prefix: @cms,
        name: :ticket_events_history_index
      )
    )

    create table(:ticket_updates, primary_key: false, prefix: @cms) do
      add(:id, :uuid, primary_key: true)

      add(:ticket_id, references(:articles, type: :uuid, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      add(
        :event_id,
        references(:ticket_events, type: :uuid, prefix: @cms, on_delete: :nilify_all)
      )

      add(:body, :text, null: false)
      add(:visibility, :string, null: false)
      add(:author_id, references(:users, prefix: @account, on_delete: :restrict), null: false)
      add(:published_at, :timestamptz)

      add(
        :supersedes_id,
        references(:ticket_updates, type: :uuid, prefix: @cms, on_delete: :nilify_all)
      )

      timestamps(updated_at: false)

      constraint(:ticket_updates, :ticket_updates_visibility_published_at_check,
        check:
          "(visibility = 'public' AND published_at IS NOT NULL) OR " <>
            "(visibility = 'internal' AND published_at IS NULL)"
      )
    end

    create(
      index(:ticket_updates, [:ticket_id, :published_at, :id],
        prefix: @cms,
        name: :ticket_updates_public_history_index,
        where: "visibility = 'public'"
      )
    )

    create(
      unique_index(:ticket_updates, [:event_id],
        prefix: @cms,
        name: :ticket_updates_event_index,
        where: "event_id IS NOT NULL"
      )
    )

    create table(:ticket_asset_refs, primary_key: false, prefix: @cms) do
      add(:id, :uuid, primary_key: true)

      add(
        :revision_id,
        references(:article_revisions, type: :uuid, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      add(:community_id, references(:communities, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      add(:asset_id, references(:community_assets, prefix: @cms, on_delete: :delete_all),
        null: false
      )

      add(:usage, :string, null: false, default: "inline")
      add(:block_id, :string)
      add(:block_type, :string)
      add(:position, :integer)
      add(:title, :string)
      add(:alt, :string)
      add(:source, :string)
      add(:meta, :map, null: false, default: %{})
      timestamps()

      constraint(:ticket_asset_refs, :ticket_asset_refs_usage_check,
        check: "usage IN ('inline', 'cover', 'cover_dark', 'attachment', 'embed')"
      )
    end

    create(
      index(:ticket_asset_refs, [:revision_id, :position, :id],
        prefix: @cms,
        name: :ticket_asset_refs_revision_index
      )
    )

    create(
      unique_index(:ticket_asset_refs, [:revision_id, :usage],
        prefix: @cms,
        name: :ticket_asset_refs_cover_index,
        where: "usage IN ('cover', 'cover_dark')"
      )
    )

    create_ticket_triggers()
  end

  def down do
    execute("DROP TRIGGER IF EXISTS ticket_public_article_guard ON #{@cms}.article_publics")
    execute("DROP FUNCTION IF EXISTS #{@cms}.ticket_public_article_guard()")
    execute("DROP TRIGGER IF EXISTS ticket_article_requires_state ON #{@cms}.articles")
    execute("DROP FUNCTION IF EXISTS #{@cms}.ticket_article_requires_state()")

    for table <- ~w(article_lifecycles article_stats trashed_articles) do
      execute("DROP TRIGGER IF EXISTS reject_ordinary_ticket_row ON #{@cms}.#{table}")
    end

    execute("DROP FUNCTION IF EXISTS #{@cms}.reject_ordinary_ticket_row()")

    drop_if_exists(
      index(:ticket_asset_refs, [:revision_id, :position, :id],
        prefix: @cms,
        name: :ticket_asset_refs_revision_index
      )
    )

    drop_if_exists(
      index(:ticket_asset_refs, [:revision_id, :usage],
        prefix: @cms,
        name: :ticket_asset_refs_cover_index
      )
    )

    drop(table(:ticket_asset_refs, prefix: @cms))

    drop_if_exists(
      index(:ticket_updates, [:event_id],
        prefix: @cms,
        name: :ticket_updates_event_index
      )
    )

    drop_if_exists(
      index(:ticket_updates, [:ticket_id, :published_at, :id],
        prefix: @cms,
        name: :ticket_updates_public_history_index
      )
    )

    drop(table(:ticket_updates, prefix: @cms))

    drop_if_exists(
      index(:ticket_events, [:ticket_id, :occurred_at, :id],
        prefix: @cms,
        name: :ticket_events_history_index
      )
    )

    drop_if_exists(
      index(:ticket_events, [:ticket_id, :command_id],
        prefix: @cms,
        name: :ticket_events_ticket_command_index
      )
    )

    drop_if_exists(
      index(:ticket_events, [:ticket_id, :id],
        prefix: @cms,
        name: :ticket_events_ticket_id_index
      )
    )

    drop(table(:ticket_events, prefix: @cms))

    drop_if_exists(
      index(:ticket_facets, [:key, :value, :ticket_id],
        prefix: @cms,
        name: :ticket_facets_filter_index
      )
    )

    drop_if_exists(
      index(:ticket_facets, [:ticket_id, :key, :value],
        prefix: @cms,
        name: :ticket_facets_ticket_key_value_index
      )
    )

    drop(table(:ticket_facets, prefix: @cms))

    drop_if_exists(
      index(:ticket_tags, [:ticket_id, :community_tag_id],
        prefix: @cms,
        name: :ticket_tags_ticket_tag_index
      )
    )

    drop(table(:ticket_tags, prefix: @cms))

    drop_if_exists(
      index(:ticket_assignees, [:user_id, :ticket_id],
        prefix: @cms,
        name: :ticket_assignees_user_ticket_index
      )
    )

    drop_if_exists(
      index(:ticket_assignees, [:ticket_id, :user_id],
        prefix: @cms,
        name: :ticket_assignees_ticket_user_index
      )
    )

    drop(table(:ticket_assignees, prefix: @cms))

    drop_if_exists(
      index(:ticket_case_workers, [:case_ticket_id, :worker_ticket_id],
        prefix: @cms,
        name: :ticket_case_workers_case_worker_index
      )
    )

    drop(table(:ticket_case_workers, prefix: @cms))

    drop_if_exists(
      index(:ticket_case_members, [:case_ticket_id, :user_ticket_id],
        prefix: @cms,
        name: :ticket_case_members_case_user_index
      )
    )

    drop(table(:ticket_case_members, prefix: @cms))

    drop_if_exists(
      index(:ticket_workers, [:parent_ticket_id, :worker_ticket_id],
        prefix: @cms,
        name: :ticket_workers_parent_worker_index
      )
    )

    drop_if_exists(
      index(:ticket_workers, [:worker_ticket_id],
        prefix: @cms,
        name: :ticket_workers_worker_ticket_index
      )
    )

    drop(table(:ticket_workers, prefix: @cms))

    drop_if_exists(
      index(:ticket_posts, [:post_id, :ticket_id],
        prefix: @cms,
        name: :ticket_posts_post_ticket_index
      )
    )

    drop_if_exists(
      index(:ticket_posts, [:ticket_id, :post_id],
        prefix: @cms,
        name: :ticket_posts_ticket_post_index
      )
    )

    drop(table(:ticket_posts, prefix: @cms))

    drop_if_exists(
      index(:ticket_states, [:planned_start_at, :planned_end_at],
        prefix: @cms,
        name: :ticket_states_planned_window_index
      )
    )

    drop_if_exists(
      index(:ticket_states, [:type, :status, :rank, :article_id],
        prefix: @cms,
        name: :ticket_states_type_status_rank_index
      )
    )

    drop(table(:ticket_states, prefix: @cms))
    execute("DROP INDEX IF EXISTS #{@cms}.article_revisions_ticket_title_prefix_index")

    drop_if_exists(
      index(:article_revisions, [:article_id, :id],
        prefix: @cms,
        name: :article_revisions_article_id_id_index
      )
    )

    drop_if_exists(
      index(:article_bindings, [:article_id, :id],
        prefix: @cms,
        name: :article_bindings_article_id_id_index
      )
    )

    execute("ALTER TABLE #{@cms}.articles DROP CONSTRAINT articles_thread_check")

    create(
      constraint(:articles, :articles_thread_check,
        prefix: @cms,
        check: "thread IN ('post', 'blog', 'changelog', 'doc')"
      )
    )
  end

  defp create_ticket_triggers do
    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_binding_singleton_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE ticket_thread text;
    BEGIN
      SELECT thread INTO ticket_thread FROM #{@cms}.articles WHERE id = NEW.article_id FOR UPDATE;
      IF ticket_thread = 'ticket' AND EXISTS (
        SELECT 1 FROM #{@cms}.article_bindings b
        WHERE b.article_id = NEW.article_id AND b.id <> COALESCE(NEW.id, -1)
      ) THEN
        RAISE EXCEPTION 'ticket_article_binding_must_be_unique' USING ERRCODE = '23505';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_binding_singleton_guard
    BEFORE INSERT OR UPDATE OF article_id, community_id ON #{@cms}.article_bindings
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_binding_singleton_guard()
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_state_article_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE ticket_inner_id integer;
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM #{@cms}.articles a WHERE a.id = NEW.article_id AND a.thread = 'ticket') THEN
        RAISE EXCEPTION 'ticket_state_requires_ticket_article' USING ERRCODE = '23514';
      END IF;
      SELECT inner_id INTO ticket_inner_id
      FROM #{@cms}.article_bindings
      WHERE id = NEW.article_binding_id AND article_id = NEW.article_id;
      IF NEW.type = 'user' AND ticket_inner_id IS NULL THEN
        RAISE EXCEPTION 'user_ticket_requires_public_number' USING ERRCODE = '23514';
      END IF;
      IF NEW.type IN ('worker', 'case') AND ticket_inner_id IS NOT NULL THEN
        RAISE EXCEPTION 'internal_ticket_cannot_have_public_number' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_state_article_guard
    BEFORE INSERT OR UPDATE OF article_id, article_binding_id ON #{@cms}.ticket_states
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_state_article_guard()
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_post_scope_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE ticket_community_id bigint; linked_post_is_public boolean;
    BEGIN
      SELECT b.community_id INTO ticket_community_id
      FROM #{@cms}.ticket_states s
      JOIN #{@cms}.article_bindings b ON b.id = s.article_binding_id
      JOIN #{@cms}.articles t ON t.id = s.article_id AND t.thread = 'ticket'
      WHERE s.article_id = NEW.ticket_id AND s.type = 'user'
        AND s.public_visibility = 'published'
      FOR UPDATE OF s;
      IF ticket_community_id IS NULL THEN
        RAISE EXCEPTION 'ticket_post_requires_public_same_community_user_ticket' USING ERRCODE = '23514';
      END IF;

      SELECT EXISTS (
        SELECT 1
        FROM #{@cms}.articles p
        JOIN #{@cms}.article_bindings b
          ON b.article_id = p.id AND b.community_id = ticket_community_id
        JOIN #{@cms}.communities c ON c.id = b.community_id
        JOIN #{@cms}.article_lifecycles al
          ON al.article_id = p.id AND al.state IN ('published', 'archived')
        LEFT JOIN #{@cms}.community_lifecycles cl ON cl.community_id = c.id
        WHERE p.id = NEW.post_id AND p.thread = 'post'
          AND ((cl.id IS NOT NULL AND cl.state IN ('active', 'read_only'))
            OR (cl.id IS NULL AND c.pending = 0))
          AND EXISTS (
            SELECT 1 FROM #{@cms}.article_publics ap
            WHERE ap.article_id = p.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM #{@cms}.trashed_articles ta
            WHERE ta.article_id = p.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM #{@cms}.article_review_blocks rb
            WHERE rb.article_id = p.id AND rb.resolved_at IS NULL
              AND (rb.community_id IS NULL OR rb.community_id = ticket_community_id)
          )
      ) INTO linked_post_is_public;

      IF NOT linked_post_is_public THEN
        RAISE EXCEPTION 'ticket_post_requires_public_same_community_user_ticket' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_post_scope_guard
    BEFORE INSERT OR UPDATE OF ticket_id, post_id ON #{@cms}.ticket_posts
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_post_scope_guard()
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_worker_scope_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE parent_community_id bigint; worker_community_id bigint;
    BEGIN
      SELECT b.community_id INTO parent_community_id
      FROM #{@cms}.ticket_states s JOIN #{@cms}.article_bindings b ON b.id = s.article_binding_id
      WHERE s.article_id = NEW.parent_ticket_id AND s.type = 'user';
      SELECT b.community_id INTO worker_community_id
      FROM #{@cms}.ticket_states s JOIN #{@cms}.article_bindings b ON b.id = s.article_binding_id
      WHERE s.article_id = NEW.worker_ticket_id AND s.type = 'worker';
      IF parent_community_id IS NULL OR worker_community_id IS NULL OR parent_community_id <> worker_community_id THEN
        RAISE EXCEPTION 'ticket_worker_requires_same_community_parent_and_worker' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_worker_scope_guard
    BEFORE INSERT OR UPDATE OF parent_ticket_id, worker_ticket_id ON #{@cms}.ticket_workers
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_worker_scope_guard()
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_case_member_scope_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE case_community_id bigint; user_community_id bigint;
    BEGIN
      SELECT b.community_id INTO case_community_id
      FROM #{@cms}.ticket_states s JOIN #{@cms}.article_bindings b ON b.id = s.article_binding_id
      WHERE s.article_id = NEW.case_ticket_id AND s.type = 'case';
      SELECT b.community_id INTO user_community_id
      FROM #{@cms}.ticket_states s JOIN #{@cms}.article_bindings b ON b.id = s.article_binding_id
      WHERE s.article_id = NEW.user_ticket_id AND s.type = 'user';
      IF case_community_id IS NULL OR user_community_id IS NULL OR case_community_id <> user_community_id THEN
        RAISE EXCEPTION 'ticket_case_member_requires_same_community_case_and_user_ticket' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_case_member_scope_guard
    BEFORE INSERT OR UPDATE OF case_ticket_id, user_ticket_id ON #{@cms}.ticket_case_members
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_case_member_scope_guard()
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_case_worker_scope_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE case_community_id bigint; worker_community_id bigint; parent_ticket_id uuid;
    BEGIN
      SELECT b.community_id INTO case_community_id
      FROM #{@cms}.ticket_states s JOIN #{@cms}.article_bindings b ON b.id = s.article_binding_id
      WHERE s.article_id = NEW.case_ticket_id AND s.type = 'case';
      SELECT b.community_id, relation.parent_ticket_id INTO worker_community_id, parent_ticket_id
      FROM #{@cms}.ticket_states s
      JOIN #{@cms}.article_bindings b ON b.id = s.article_binding_id
      JOIN #{@cms}.ticket_workers relation ON relation.worker_ticket_id = s.article_id
      WHERE s.article_id = NEW.worker_ticket_id AND s.type = 'worker';
      IF case_community_id IS NULL OR worker_community_id IS NULL OR case_community_id <> worker_community_id OR
         NOT EXISTS (SELECT 1 FROM #{@cms}.ticket_case_members m
                     WHERE m.case_ticket_id = NEW.case_ticket_id AND m.user_ticket_id = parent_ticket_id) THEN
        RAISE EXCEPTION 'ticket_case_worker_must_serve_a_case_member' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_case_worker_scope_guard
    BEFORE INSERT OR UPDATE OF case_ticket_id, worker_ticket_id ON #{@cms}.ticket_case_workers
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_case_worker_scope_guard()
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_tag_scope_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM #{@cms}.ticket_states s
        JOIN #{@cms}.article_bindings b ON b.id = s.article_binding_id
        JOIN #{@cms}.community_tags t ON t.id = NEW.community_tag_id
        WHERE s.article_id = NEW.ticket_id AND t.community_id = b.community_id AND t.thread = 'post'
      ) THEN
        RAISE EXCEPTION 'ticket_tag_must_use_same_community_post_tag' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_tag_scope_guard
    BEFORE INSERT OR UPDATE OF ticket_id, community_tag_id ON #{@cms}.ticket_tags
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_tag_scope_guard()
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_public_update_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.visibility = 'public' AND NOT EXISTS (
        SELECT 1 FROM #{@cms}.ticket_states s
        WHERE s.article_id = NEW.ticket_id AND s.type = 'user' AND s.public_visibility = 'published'
      ) THEN
        RAISE EXCEPTION 'public_ticket_update_requires_published_user_ticket' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_public_update_guard
    BEFORE INSERT OR UPDATE OF ticket_id, visibility ON #{@cms}.ticket_updates
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_public_update_guard()
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_event_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM #{@cms}.ticket_states s WHERE s.article_id = NEW.ticket_id) THEN
        RAISE EXCEPTION 'ticket_event_requires_ticket_state' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_event_guard
    BEFORE INSERT OR UPDATE OF ticket_id ON #{@cms}.ticket_events
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_event_guard()
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_public_article_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM #{@cms}.articles a WHERE a.id = NEW.article_id AND a.thread = 'ticket')
         AND NOT EXISTS (
           SELECT 1
           FROM #{@cms}.ticket_states s
           JOIN #{@cms}.article_bindings b ON b.id = s.article_binding_id AND b.article_id = s.article_id
           WHERE s.article_id = NEW.article_id AND s.type = 'user'
             AND s.public_visibility = 'published'
             AND s.current_revision_id = NEW.revision_id
             AND b.inner_id IS NOT NULL
         ) THEN
        RAISE EXCEPTION 'article_public_requires_published_user_ticket_revision' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_public_article_guard
    BEFORE INSERT OR UPDATE OF article_id, revision_id ON #{@cms}.article_publics
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_public_article_guard()
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_article_requires_state()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.thread = 'ticket' AND NOT EXISTS (
        SELECT 1 FROM #{@cms}.ticket_states s WHERE s.article_id = NEW.id
      ) THEN
        RAISE EXCEPTION 'ticket_article_requires_ticket_state' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE CONSTRAINT TRIGGER ticket_article_requires_state
    AFTER INSERT OR UPDATE OF thread ON #{@cms}.articles
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_article_requires_state()
    """)

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.reject_ordinary_ticket_row()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM #{@cms}.articles a WHERE a.id = NEW.article_id AND a.thread = 'ticket') THEN
        RAISE EXCEPTION 'ticket_has_no_ordinary_article_lifecycle_stats_or_trash' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    for table <- ~w(article_lifecycles article_stats trashed_articles) do
      execute("""
      CREATE TRIGGER reject_ordinary_ticket_row
      BEFORE INSERT OR UPDATE OF article_id ON #{@cms}.#{table}
      FOR EACH ROW EXECUTE FUNCTION #{@cms}.reject_ordinary_ticket_row()
      """)
    end

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_asset_revision_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM #{@cms}.article_revisions r
        JOIN #{@cms}.articles a ON a.id = r.article_id AND a.thread = 'ticket'
        JOIN #{@cms}.ticket_states s ON s.article_id = a.id
        JOIN #{@cms}.article_bindings b ON b.id = s.article_binding_id
        WHERE r.id = NEW.revision_id AND b.community_id = NEW.community_id
      ) THEN
        RAISE EXCEPTION 'ticket_asset_ref_requires_same_community_ticket_revision' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_asset_revision_guard
    BEFORE INSERT OR UPDATE OF revision_id, community_id ON #{@cms}.ticket_asset_refs
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_asset_revision_guard()
    """)
  end
end
