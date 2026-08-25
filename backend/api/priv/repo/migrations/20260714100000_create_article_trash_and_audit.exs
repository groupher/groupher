defmodule GroupherServer.Repo.Migrations.CreateArticleTrashAndAudit do
  use Ecto.Migration

  @moduledoc """
  Replaces per-Article `mark_delete` flags and the draft-only Docs trash table
  with one current Trash membership model plus append-only CMS audit records.

  This is an intentional one-way cutover. Runtime code has no legacy
  read/write path after this migration.
  """

  @prefix "cms"
  @article_tables [posts: "post", blogs: "blog", changelogs: "changelog", docs: "doc"]

  def up do
    execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    create table(:trash_actions, prefix: @prefix) do
      add(:hash_id, :uuid, null: false, default: fragment("gen_random_uuid()"))

      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:actor_id, references(:users, prefix: "account", on_delete: :nilify_all))
      add(:root_type, :string, null: false)
      add(:root_ref, :string, null: false)
      add(:deleted_at, :timestamptz, null: false)
      add(:scheduled_permanent_deletion_at, :timestamptz, null: false)

      timestamps()
    end

    create(unique_index(:trash_actions, [:hash_id], prefix: @prefix))
    create(index(:trash_actions, [:community_id, :deleted_at], prefix: @prefix))
    create(index(:trash_actions, [:scheduled_permanent_deletion_at], prefix: @prefix))

    create table(:trashed_articles, prefix: @prefix) do
      add(:hash_id, :uuid, null: false, default: fragment("gen_random_uuid()"))

      add(
        :trash_action_id,
        references(:trash_actions, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:thread, :string, null: false)
      add(:article_hash_id, :uuid, null: false)
      add(:deleted_by_id, references(:users, prefix: "account", on_delete: :nilify_all))
      add(:deleted_at, :timestamptz, null: false)

      timestamps()
    end

    create(unique_index(:trashed_articles, [:hash_id], prefix: @prefix))

    create(
      unique_index(:trashed_articles, [:community_id, :thread, :article_hash_id],
        prefix: @prefix,
        name: :trashed_articles_logical_article_index
      )
    )

    create(index(:trashed_articles, [:trash_action_id], prefix: @prefix))
    create(index(:trashed_articles, [:community_id, :thread, :deleted_at], prefix: @prefix))

    create(
      constraint(:trashed_articles, :trashed_articles_thread_check,
        prefix: @prefix,
        check: "thread IN ('post', 'blog', 'changelog', 'doc')"
      )
    )

    create table(:trashed_doc_tree_nodes, prefix: @prefix) do
      add(:hash_id, :uuid, null: false, default: fragment("gen_random_uuid()"))

      add(
        :trash_action_id,
        references(:trash_actions, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:branch_id, references(:article_branches, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:node_id, :string, null: false)
      add(:doc_id, :uuid)
      add(:type, :string, null: false)
      add(:draft_snapshot, :map)
      add(:public_snapshot, :map)
      add(:deleted_by_id, references(:users, prefix: "account", on_delete: :nilify_all))
      add(:deleted_at, :timestamptz, null: false)

      timestamps()
    end

    create(unique_index(:trashed_doc_tree_nodes, [:hash_id], prefix: @prefix))

    create(
      unique_index(:trashed_doc_tree_nodes, [:trash_action_id, :node_id],
        prefix: @prefix,
        name: :trashed_doc_tree_nodes_action_node_index
      )
    )

    create(index(:trashed_doc_tree_nodes, [:trash_action_id], prefix: @prefix))

    create(
      index(:trashed_doc_tree_nodes, [:community_id, :branch_id, :deleted_at], prefix: @prefix)
    )

    create(
      constraint(:trashed_doc_tree_nodes, :trashed_doc_tree_nodes_snapshot_check,
        prefix: @prefix,
        check: "draft_snapshot IS NOT NULL OR public_snapshot IS NOT NULL"
      )
    )

    create(
      constraint(:trashed_doc_tree_nodes, :trashed_doc_tree_nodes_type_check,
        prefix: @prefix,
        check: "type IN ('tab', 'group', 'page', 'link', 'pin')"
      )
    )

    create table(:audit_logs, prefix: @prefix) do
      add(:hash_id, :uuid, null: false, default: fragment("gen_random_uuid()"))
      add(:community_id, :bigint, null: false)
      add(:actor_type, :string, null: false)
      add(:actor_id, :bigint)
      add(:actor_snapshot, :map, null: false, default: %{})
      add(:action, :string, null: false)
      add(:resource_type, :string, null: false)
      add(:resource_ref, :string, null: false)
      add(:resource_snapshot, :map, null: false, default: %{})
      add(:operation_ref, :uuid)
      add(:source, :string, null: false)
      add(:metadata, :map, null: false, default: %{})
      add(:occurred_at, :timestamptz, null: false)
      add(:inserted_at, :timestamptz, null: false, default: fragment("NOW()"))
    end

    create(unique_index(:audit_logs, [:hash_id], prefix: @prefix))
    create(index(:audit_logs, [:community_id, :occurred_at], prefix: @prefix))
    create(index(:audit_logs, [:community_id, :action, :occurred_at], prefix: @prefix))
    create(index(:audit_logs, [:resource_type, :resource_ref, :occurred_at], prefix: @prefix))
    create(index(:audit_logs, [:operation_ref], prefix: @prefix))

    flush()

    Enum.each(@article_tables, fn {table, thread} -> backfill_mark_deleted(table, thread) end)

    convert_shared_doc_pages_to_links()

    create(
      unique_index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :doc_id],
        prefix: @prefix,
        where: "type = 'page' AND doc_id IS NOT NULL",
        name: :doc_tree_nodes_stage_doc_id_index
      )
    )

    drop_if_exists(table(:doc_tree_restore_audits, prefix: @prefix))
    drop_if_exists(table(:doc_tree_trash_items, prefix: @prefix))

    Enum.each(@article_tables, fn {table, _thread} ->
      alter table(table, prefix: @prefix) do
        remove(:mark_delete)
      end
    end)
  end

  def down do
    raise "CreateArticleTrashAndAudit is intentionally irreversible"
  end

  defp backfill_mark_deleted(table, thread) do
    execute("""
    INSERT INTO #{@prefix}.trash_actions (
      hash_id,
      community_id,
      actor_id,
      root_type,
      root_ref,
      deleted_at,
      scheduled_permanent_deletion_at,
      inserted_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      article.community_id,
      NULL,
      'article',
      '#{thread}:' || article.article_hash_id::text,
      NOW(),
      NOW() + INTERVAL '30 days',
      NOW(),
      NOW()
    FROM #{@prefix}.#{table} AS article
    WHERE article.mark_delete IS TRUE
    GROUP BY article.community_id, article.article_hash_id;
    """)

    execute("""
    INSERT INTO #{@prefix}.trashed_articles (
      hash_id,
      trash_action_id,
      community_id,
      thread,
      article_hash_id,
      deleted_by_id,
      deleted_at,
      inserted_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      action.id,
      action.community_id,
      '#{thread}',
      split_part(action.root_ref, ':', 2)::uuid,
      NULL,
      action.deleted_at,
      action.inserted_at,
      action.updated_at
    FROM #{@prefix}.trash_actions AS action
    WHERE action.root_type = 'article'
      AND action.root_ref LIKE '#{thread}:%';
    """)

    execute("""
    INSERT INTO #{@prefix}.audit_logs (
      hash_id,
      community_id,
      actor_type,
      actor_id,
      actor_snapshot,
      action,
      resource_type,
      resource_ref,
      resource_snapshot,
      operation_ref,
      source,
      metadata,
      occurred_at,
      inserted_at
    )
    SELECT
      gen_random_uuid(),
      action.community_id,
      'system',
      NULL,
      '{}'::jsonb,
      'article.trashed',
      '#{thread}',
      split_part(action.root_ref, ':', 2),
      '{}'::jsonb,
      action.hash_id,
      'migration',
      '{"backfilled":true}'::jsonb,
      action.deleted_at,
      NOW()
    FROM #{@prefix}.trash_actions AS action
    WHERE action.root_type = 'article'
      AND action.root_ref LIKE '#{thread}:%';
    """)
  end

  defp convert_shared_doc_pages_to_links do
    execute("""
    WITH ranked AS (
      SELECT
        node.id,
        ROW_NUMBER() OVER (
          PARTITION BY node.community_id, node.branch_id, node.stage, node.doc_id
          ORDER BY node.id
        ) AS row_number
      FROM #{@prefix}.doc_tree_nodes AS node
      WHERE node.type = 'page'
        AND node.doc_id IS NOT NULL
    )
    UPDATE #{@prefix}.doc_tree_nodes AS node
    SET
      type = 'link',
      href = '/' || community.slug || '/doc/' || node.doc_id::text,
      doc_id = NULL,
      updated_at = NOW()
    FROM ranked
    JOIN #{@prefix}.communities AS community ON TRUE
    WHERE ranked.id = node.id
      AND ranked.row_number > 1
      AND community.id = node.community_id;
    """)
  end
end
