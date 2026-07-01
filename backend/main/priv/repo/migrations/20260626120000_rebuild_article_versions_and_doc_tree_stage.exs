defmodule GroupherServer.Repo.Migrations.RebuildArticleWorkspacesAndDocTreeStage do
  use Ecto.Migration

  @prefix "cms"

  def up do
    unless final_docs_stage_schema_exists?() do
      execute("DROP TABLE IF EXISTS #{@prefix}.doc_cover_pinned_items CASCADE;")
      execute("DROP TABLE IF EXISTS #{@prefix}.doc_cover_items CASCADE;")
      execute("DROP TABLE IF EXISTS #{@prefix}.doc_cover_groups CASCADE;")
      execute("DROP TABLE IF EXISTS #{@prefix}.doc_tree_node_publish_mappings CASCADE;")
      execute("DROP TABLE IF EXISTS #{@prefix}.doc_tree_node_drafts CASCADE;")
      execute("DROP TABLE IF EXISTS #{@prefix}.doc_tree_nodes CASCADE;")
      execute("DROP TABLE IF EXISTS #{@prefix}.article_snapshots CASCADE;")
      execute("DROP TABLE IF EXISTS #{@prefix}.article_drafts CASCADE;")
      execute("DROP TABLE IF EXISTS #{@prefix}.article_workspaces CASCADE;")
      execute("DROP TABLE IF EXISTS #{@prefix}.publish_requests CASCADE;")
      execute("DROP TABLE IF EXISTS #{@prefix}.publish_release_tree_events CASCADE;")
      execute("DROP TABLE IF EXISTS #{@prefix}.publish_release_articles CASCADE;")
      execute("DROP TABLE IF EXISTS #{@prefix}.publish_releases CASCADE;")
      execute("DROP TABLE IF EXISTS #{@prefix}.doc_tree_trash_items CASCADE;")

      create table(:article_workspaces, prefix: @prefix) do
        add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
          null: false
        )

        add(:article_id, :bigint)
        add(:article_thread, :string, null: false)
        add(:stage, :string, null: false)
        add(:author_id, references(:authors, prefix: @prefix, on_delete: :nilify_all))
        add(:title, :string, null: false)
        add(:subtitle, :string)
        add(:slug, :string, null: false)
        add(:digest, :string, null: false)
        add(:template_key, :string)
        add(:json, :text, null: false)
        add(:markdown, :text)
        add(:markdown_toc, :map)
        add(:html, :text)
        add(:xml, :text)
        add(:rss, :text)
        add(:plain_text, :text)
        add(:content_hash, :string)
        add(:schema_version, :integer, null: false, default: 1)

        timestamps()
      end

      create(index(:article_workspaces, [:community_id], prefix: @prefix))
      create(index(:article_workspaces, [:article_thread, :article_id], prefix: @prefix))
      create(index(:article_workspaces, [:author_id], prefix: @prefix))
      create(index(:article_workspaces, [:content_hash], prefix: @prefix))
      create(unique_index(:article_workspaces, [:community_id, :template_key], prefix: @prefix))

      create(
        unique_index(:article_workspaces, [:community_id, :article_thread, :stage, :article_id],
          prefix: @prefix,
          where: "article_id IS NOT NULL",
          name: :article_workspaces_identity_stage_index
        )
      )

      create(
        constraint(:article_workspaces, :article_workspaces_stage_check,
          prefix: @prefix,
          check: "stage IN ('draft')"
        )
      )

      create(
        constraint(:article_workspaces, :article_workspaces_article_thread_check,
          prefix: @prefix,
          check: "article_thread IN ('post', 'doc', 'changelog', 'blog')"
        )
      )

      create table(:article_snapshots, prefix: @prefix) do
        add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
          null: false
        )

        add(:article_id, :bigint)

        add(
          :workspace_id,
          references(:article_workspaces, prefix: @prefix, on_delete: :delete_all)
        )

        add(:article_thread, :string, null: false)
        add(:stage, :string, null: false)
        add(:author_id, references(:authors, prefix: @prefix, on_delete: :nilify_all))
        add(:title, :string, null: false)
        add(:slug, :string)
        add(:subtitle, :string)
        add(:digest, :text)
        add(:document_json, :text, null: false)
        add(:content_hash, :string, null: false)
        add(:snapshot_number, :integer, null: false)
        add(:schema_version, :integer, null: false, default: 1)

        timestamps()
      end

      create(index(:article_snapshots, [:community_id], prefix: @prefix))
      create(index(:article_snapshots, [:article_thread, :article_id], prefix: @prefix))
      create(index(:article_snapshots, [:article_thread, :workspace_id], prefix: @prefix))
      create(index(:article_snapshots, [:stage], prefix: @prefix))
      create(index(:article_snapshots, [:content_hash], prefix: @prefix))
      create(index(:article_snapshots, [:inserted_at], prefix: @prefix))

      create(
        constraint(:article_snapshots, :article_snapshots_target_check,
          prefix: @prefix,
          check:
            "(stage = 'draft' AND workspace_id IS NOT NULL AND article_id IS NULL) OR (stage = 'public' AND article_id IS NOT NULL AND workspace_id IS NULL)"
        )
      )

      create(
        constraint(:article_snapshots, :article_snapshots_stage_check,
          prefix: @prefix,
          check: "stage IN ('draft', 'public')"
        )
      )

      create(
        constraint(:article_snapshots, :article_snapshots_article_thread_check,
          prefix: @prefix,
          check: "article_thread IN ('post', 'doc', 'changelog', 'blog')"
        )
      )

      create table(:publish_requests, prefix: @prefix) do
        add(:target_type, :string, null: false)
        add(:target_id, :string, null: false)
        add(:status, :string, null: false, default: "pending")
        add(:base_snapshot_id, :bigint)
        add(:requested_by_id, references(:users, prefix: "account", on_delete: :nilify_all))
        add(:reviewed_by_id, references(:users, prefix: "account", on_delete: :nilify_all))
        add(:requested_at, :timestamptz)
        add(:reviewed_at, :timestamptz)
        add(:note, :text)

        timestamps()
      end

      create(index(:publish_requests, [:target_type, :target_id], prefix: @prefix))
      create(index(:publish_requests, [:status], prefix: @prefix))

      create table(:doc_tree_nodes, prefix: @prefix) do
        add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
          null: false
        )

        add(:node_id, :string, null: false)
        add(:stage, :string, null: false)
        add(:type, :string, null: false)
        add(:group_id, :string)

        add(
          :workspace_id,
          references(:article_workspaces, prefix: @prefix, on_delete: :nilify_all)
        )

        add(:doc_id, references(:docs, prefix: @prefix, on_delete: :nilify_all))
        add(:title, :string)
        add(:slug, :string)
        add(:index, :integer, null: false, default: 0)
        add(:href, :string)
        add(:marker, :map)
        add(:badge, :string)
        add(:hidden, :boolean, null: false, default: false)
        add(:template_key, :string)
        add(:ui_config, :map, null: false, default: %{})

        timestamps()
      end

      create(index(:doc_tree_nodes, [:community_id], prefix: @prefix))
      create(index(:doc_tree_nodes, [:community_id, :stage], prefix: @prefix))
      create(index(:doc_tree_nodes, [:group_id], prefix: @prefix))
      create(index(:doc_tree_nodes, [:workspace_id], prefix: @prefix))
      create(index(:doc_tree_nodes, [:doc_id], prefix: @prefix))

      create(
        unique_index(:doc_tree_nodes, [:community_id, :stage, :node_id],
          prefix: @prefix,
          name: :doc_tree_nodes_stage_node_id_index
        )
      )

      create(
        unique_index(:doc_tree_nodes, [:community_id, :stage, :template_key],
          prefix: @prefix,
          where: "template_key IS NOT NULL",
          name: :doc_tree_nodes_community_stage_template_key_index
        )
      )

      create(
        unique_index(:doc_tree_nodes, [:community_id, :stage, :slug],
          prefix: @prefix,
          where: "group_id IS NULL AND type = 'group'",
          name: :doc_tree_nodes_root_slug_index
        )
      )

      create(
        unique_index(:doc_tree_nodes, [:community_id, :stage, :title],
          prefix: @prefix,
          where: "group_id IS NULL AND type = 'group'",
          name: :doc_tree_nodes_root_title_index
        )
      )

      create(
        unique_index(:doc_tree_nodes, [:community_id, :stage, :group_id, :slug],
          prefix: @prefix,
          where: "group_id IS NOT NULL AND slug IS NOT NULL",
          name: :doc_tree_nodes_sibling_slug_index
        )
      )

      create(
        unique_index(:doc_tree_nodes, [:community_id, :stage, :group_id, :title],
          prefix: @prefix,
          where: "group_id IS NOT NULL AND title IS NOT NULL",
          name: :doc_tree_nodes_sibling_title_index
        )
      )

      create(
        constraint(:doc_tree_nodes, :doc_tree_nodes_stage_check,
          prefix: @prefix,
          check: "stage IN ('draft', 'public')"
        )
      )

      create(
        constraint(:doc_tree_nodes, :doc_tree_nodes_type_check,
          prefix: @prefix,
          check: "type IN ('group', 'page', 'link', 'pin')"
        )
      )

      create table(:doc_tree_trash_items, prefix: @prefix) do
        add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
          null: false
        )

        add(:node_id, :string, null: false)
        add(:article_id, :bigint)

        add(
          :workspace_id,
          references(:article_workspaces, prefix: @prefix, on_delete: :nilify_all)
        )

        add(:node_snapshot, :map, null: false)
        add(:deleted_from_group_id, :string)
        add(:deleted_from_index, :integer)
        add(:deleted_at, :timestamptz, null: false)
        add(:deleted_by_id, references(:users, prefix: "account", on_delete: :nilify_all))
        add(:restored_at, :timestamptz)

        timestamps()
      end

      create(index(:doc_tree_trash_items, [:community_id], prefix: @prefix))
      create(index(:doc_tree_trash_items, [:node_id], prefix: @prefix))
      create(index(:doc_tree_trash_items, [:workspace_id], prefix: @prefix))

      create table(:doc_cover_groups, prefix: @prefix) do
        add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
          null: false
        )

        add(:group_id, references(:doc_tree_nodes, prefix: @prefix, on_delete: :delete_all),
          null: false
        )

        add(:index, :integer, null: false, default: 0)
        add(:ui_config, :map, null: false, default: %{})

        timestamps()
      end

      create(index(:doc_cover_groups, [:community_id], prefix: @prefix))
      create(index(:doc_cover_groups, [:group_id], prefix: @prefix))

      create(
        unique_index(:doc_cover_groups, [:community_id, :group_id],
          prefix: @prefix,
          name: :doc_cover_groups_community_group_index
        )
      )

      create table(:doc_cover_items, prefix: @prefix) do
        add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
          null: false
        )

        add(
          :cover_group_id,
          references(:doc_cover_groups, prefix: @prefix, on_delete: :delete_all), null: false)

        add(:node_id, references(:doc_tree_nodes, prefix: @prefix, on_delete: :delete_all),
          null: false
        )

        add(:index, :integer, null: false, default: 0)
        add(:hidden, :boolean, null: false, default: false)
        add(:ui_config, :map, null: false, default: %{})

        timestamps()
      end

      create(index(:doc_cover_items, [:community_id], prefix: @prefix))
      create(index(:doc_cover_items, [:cover_group_id], prefix: @prefix))
      create(index(:doc_cover_items, [:node_id], prefix: @prefix))

      create(
        unique_index(:doc_cover_items, [:cover_group_id, :node_id],
          prefix: @prefix,
          name: :doc_cover_items_cover_group_node_index
        )
      )

      create table(:doc_cover_pinned_items, prefix: @prefix) do
        add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
          null: false
        )

        add(:node_id, references(:doc_tree_nodes, prefix: @prefix, on_delete: :delete_all),
          null: false
        )

        add(:index, :integer, null: false, default: 0)
        add(:ui_config, :map, null: false, default: %{})

        timestamps()
      end

      create(index(:doc_cover_pinned_items, [:community_id], prefix: @prefix))
      create(index(:doc_cover_pinned_items, [:node_id], prefix: @prefix))

      create(
        unique_index(:doc_cover_pinned_items, [:community_id, :node_id],
          prefix: @prefix,
          name: :doc_cover_pinned_items_community_node_index
        )
      )
    end
  end

  defp final_docs_stage_schema_exists? do
    %{rows: [[exists?]]} =
      repo().query!(
        """
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns docs_doc_id
          JOIN information_schema.columns docs_stage
            ON docs_stage.table_schema = docs_doc_id.table_schema
           AND docs_stage.table_name = docs_doc_id.table_name
           AND docs_stage.column_name = 'stage'
          JOIN information_schema.columns tree_stage
            ON tree_stage.table_schema = docs_doc_id.table_schema
           AND tree_stage.table_name = 'doc_tree_nodes'
           AND tree_stage.column_name = 'stage'
          JOIN information_schema.columns tree_doc_id
            ON tree_doc_id.table_schema = docs_doc_id.table_schema
           AND tree_doc_id.table_name = 'doc_tree_nodes'
           AND tree_doc_id.column_name = 'doc_id'
           AND tree_doc_id.data_type = 'uuid'
          WHERE docs_doc_id.table_schema = '#{@prefix}'
            AND docs_doc_id.table_name = 'docs'
            AND docs_doc_id.column_name = 'doc_id'
            AND docs_doc_id.data_type = 'uuid'
        );
        """,
        []
      )

    exists?
  end

  def down do
    raise "irreversible migration: article versions and doc tree stage model replaced legacy draft/public mapping tables"
  end
end
