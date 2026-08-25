defmodule GroupherServer.Repo.Migrations.AddDocsBranchScope do
  use Ecto.Migration

  @prefix "cms"
  @account_prefix "account"

  def change do
    create table(:docs_branches, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:slug, :string, null: false)
      add(:title, :string, null: false)
      add(:kind, :string, null: false, default: "main")
      add(:status, :string, null: false, default: "active")

      add(
        :base_release_id,
        references(:publish_releases, prefix: @prefix, on_delete: :nilify_all)
      )

      add(
        :base_snapshot_id,
        references(:doc_tree_snapshots, prefix: @prefix, on_delete: :nilify_all)
      )

      add(:created_by_id, references(:users, prefix: @account_prefix, on_delete: :nilify_all))

      timestamps()
    end

    create(
      unique_index(:docs_branches, [:community_id, :slug],
        prefix: @prefix,
        name: :docs_branches_community_slug_index
      )
    )

    create(index(:docs_branches, [:community_id], prefix: @prefix))
    create(index(:docs_branches, [:status], prefix: @prefix))

    create(
      constraint(:docs_branches, :docs_branches_kind_check,
        check: "kind IN ('main', 'preview')",
        prefix: @prefix
      )
    )

    create(
      constraint(:docs_branches, :docs_branches_status_check,
        check: "status IN ('active', 'archived')",
        prefix: @prefix
      )
    )

    alter table(:docs, prefix: @prefix) do
      add(:branch_id, references(:docs_branches, prefix: @prefix, on_delete: :delete_all))
    end

    alter table(:article_snapshots, prefix: @prefix) do
      add(:branch_id, references(:docs_branches, prefix: @prefix, on_delete: :delete_all))
    end

    alter table(:docs_site_states, prefix: @prefix) do
      add(:branch_id, references(:docs_branches, prefix: @prefix, on_delete: :delete_all))
    end

    alter table(:doc_tree_nodes, prefix: @prefix) do
      add(:branch_id, references(:docs_branches, prefix: @prefix, on_delete: :delete_all))
    end

    alter table(:doc_tree_events, prefix: @prefix) do
      add(:branch_id, references(:docs_branches, prefix: @prefix, on_delete: :delete_all))
    end

    alter table(:doc_tree_snapshots, prefix: @prefix) do
      add(:branch_id, references(:docs_branches, prefix: @prefix, on_delete: :delete_all))
    end

    alter table(:doc_tree_trash_items, prefix: @prefix) do
      add(:branch_id, references(:docs_branches, prefix: @prefix, on_delete: :delete_all))
    end

    alter table(:doc_tree_restore_audits, prefix: @prefix) do
      add(:branch_id, references(:docs_branches, prefix: @prefix, on_delete: :delete_all))
    end

    alter table(:publish_releases, prefix: @prefix) do
      add(:branch_id, references(:docs_branches, prefix: @prefix, on_delete: :delete_all))
      add(:version_slug, :string)
    end

    execute(seed_main_branches())
    backfill_main_branch_ids()

    require_branch_id(:docs)
    require_branch_id(:docs_site_states)
    require_branch_id(:doc_tree_nodes)
    require_branch_id(:doc_tree_events)
    require_branch_id(:doc_tree_snapshots)
    require_branch_id(:doc_tree_trash_items)
    require_branch_id(:doc_tree_restore_audits)
    require_branch_id(:publish_releases)

    execute(
      ~s|ALTER TABLE "#{@prefix}"."publish_releases" ALTER COLUMN version_slug SET NOT NULL;|
    )

    rebuild_branch_indexes()
  end

  defp seed_main_branches do
    """
    INSERT INTO #{@prefix}.docs_branches (community_id, slug, title, kind, status, inserted_at, updated_at)
    SELECT id, 'main', 'main', 'main', 'active', NOW(), NOW()
    FROM #{@prefix}.communities
    ON CONFLICT (community_id, slug) DO NOTHING;
    """
  end

  defp backfill_main_branch_ids do
    execute("""
    UPDATE #{@prefix}.docs AS target
    SET branch_id = branch.id
    FROM #{@prefix}.docs_branches AS branch
    WHERE branch.community_id = target.community_id AND branch.slug = 'main';
    """)

    execute("""
    UPDATE #{@prefix}.article_snapshots AS target
    SET branch_id = branch.id
    FROM #{@prefix}.docs_branches AS branch
    WHERE branch.community_id = target.community_id
      AND branch.slug = 'main'
      AND target.thread = 'doc';
    """)

    execute("""
    UPDATE #{@prefix}.docs_site_states AS target
    SET branch_id = branch.id
    FROM #{@prefix}.docs_branches AS branch
    WHERE branch.community_id = target.community_id AND branch.slug = 'main';
    """)

    execute("""
    UPDATE #{@prefix}.doc_tree_nodes AS target
    SET branch_id = branch.id
    FROM #{@prefix}.docs_branches AS branch
    WHERE branch.community_id = target.community_id AND branch.slug = 'main';
    """)

    execute("""
    UPDATE #{@prefix}.doc_tree_events AS target
    SET branch_id = branch.id
    FROM #{@prefix}.docs_branches AS branch
    WHERE branch.community_id = target.community_id AND branch.slug = 'main';
    """)

    execute("""
    UPDATE #{@prefix}.doc_tree_snapshots AS target
    SET branch_id = branch.id
    FROM #{@prefix}.docs_branches AS branch
    WHERE branch.community_id = target.community_id AND branch.slug = 'main';
    """)

    execute("""
    UPDATE #{@prefix}.doc_tree_trash_items AS target
    SET branch_id = branch.id
    FROM #{@prefix}.docs_branches AS branch
    WHERE branch.community_id = target.community_id AND branch.slug = 'main';
    """)

    execute("""
    UPDATE #{@prefix}.doc_tree_restore_audits AS target
    SET branch_id = branch.id
    FROM #{@prefix}.docs_branches AS branch
    WHERE branch.community_id = target.community_id AND branch.slug = 'main';
    """)

    execute("""
    UPDATE #{@prefix}.publish_releases AS target
    SET branch_id = branch.id,
        version_slug = 'v' || target.release_number::text
    FROM #{@prefix}.docs_branches AS branch
    WHERE branch.community_id = target.community_id AND branch.slug = 'main';
    """)
  end

  defp require_branch_id(table) do
    execute(~s|ALTER TABLE "#{@prefix}"."#{table}" ALTER COLUMN branch_id SET NOT NULL;|)
  end

  defp rebuild_branch_indexes do
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."docs_community_stage_doc_id_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."docs_public_slug_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."doc_tree_nodes_stage_node_id_index";|)

    execute(
      ~s|DROP INDEX IF EXISTS "#{@prefix}"."doc_tree_nodes_community_stage_template_key_index";|
    )

    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."doc_tree_nodes_root_slug_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."doc_tree_nodes_root_title_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."doc_tree_nodes_sibling_slug_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."doc_tree_nodes_sibling_title_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."doc_tree_events_community_seq_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."publish_releases_community_number_index";|)
    execute(~s|DROP INDEX IF EXISTS "#{@prefix}"."docs_site_states_community_id_index";|)

    create(
      unique_index(:docs, [:community_id, :branch_id, :stage, :doc_id],
        prefix: @prefix,
        name: :docs_community_stage_doc_id_index
      )
    )

    create(
      unique_index(:docs_site_states, [:branch_id],
        prefix: @prefix,
        name: :docs_site_states_branch_id_index
      )
    )

    create(index(:article_snapshots, [:branch_id], prefix: @prefix))
    create(index(:doc_tree_nodes, [:branch_id], prefix: @prefix))
    create(index(:doc_tree_events, [:branch_id], prefix: @prefix))
    create(index(:doc_tree_snapshots, [:branch_id], prefix: @prefix))
    create(index(:doc_tree_trash_items, [:branch_id], prefix: @prefix))
    create(index(:doc_tree_restore_audits, [:branch_id], prefix: @prefix))
    create(index(:publish_releases, [:branch_id], prefix: @prefix))

    create(
      unique_index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :node_id],
        prefix: @prefix,
        name: :doc_tree_nodes_stage_node_id_index
      )
    )

    create(
      unique_index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :template_key],
        prefix: @prefix,
        where: "template_key IS NOT NULL",
        name: :doc_tree_nodes_community_stage_template_key_index
      )
    )

    create(
      unique_index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :type, :slug],
        prefix: @prefix,
        where: "group_id IS NULL AND slug IS NOT NULL",
        name: :doc_tree_nodes_root_slug_index
      )
    )

    create(
      unique_index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :type, :title],
        prefix: @prefix,
        where: "group_id IS NULL AND title IS NOT NULL",
        name: :doc_tree_nodes_root_title_index
      )
    )

    create(
      unique_index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :group_id, :slug],
        prefix: @prefix,
        where: "group_id IS NOT NULL AND slug IS NOT NULL",
        name: :doc_tree_nodes_sibling_slug_index
      )
    )

    create(
      unique_index(:doc_tree_nodes, [:community_id, :branch_id, :stage, :group_id, :title],
        prefix: @prefix,
        where: "group_id IS NOT NULL AND title IS NOT NULL",
        name: :doc_tree_nodes_sibling_title_index
      )
    )

    create(
      unique_index(:doc_tree_events, [:community_id, :branch_id, :seq],
        prefix: @prefix,
        name: :doc_tree_events_community_seq_index
      )
    )

    create(
      unique_index(:publish_releases, [:community_id, :branch_id, :release_number],
        prefix: @prefix,
        name: :publish_releases_branch_number_index
      )
    )

    create(
      unique_index(:publish_releases, [:community_id, :branch_id, :version_slug],
        prefix: @prefix,
        name: :publish_releases_branch_version_slug_index
      )
    )
  end
end
