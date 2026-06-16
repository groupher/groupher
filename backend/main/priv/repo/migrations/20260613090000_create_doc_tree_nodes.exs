defmodule GroupherServer.Repo.Migrations.CreateDocTreeNodes do
  use Ecto.Migration

  @prefix "cms"

  def change do
    create table(:docs_site_states, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:draft_revision, :integer, null: false, default: 0)
      add(:published_revision, :integer, null: false, default: 0)
      add(:last_published_draft_revision, :integer, null: false, default: 0)
      add(:last_published_at, :timestamptz)
      add(:last_published_by_id, references(:users, prefix: "account", on_delete: :nilify_all))

      timestamps()
    end

    create(unique_index(:docs_site_states, [:community_id], prefix: @prefix))

    create table(:doc_tree_draft_states, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:revision, :integer, null: false, default: 0)

      timestamps()
    end

    create(unique_index(:doc_tree_draft_states, [:community_id], prefix: @prefix))

    create table(:doc_drafts, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:published_doc_id, references(:docs, prefix: @prefix, on_delete: :nilify_all))
      add(:author_id, references(:authors, prefix: @prefix, on_delete: :nilify_all))
      add(:title, :string, null: false)
      add(:slug, :string, null: false)
      add(:digest, :string, null: false)
      add(:template_key, :string)

      timestamps()
    end

    create(index(:doc_drafts, [:community_id], prefix: @prefix))
    create(index(:doc_drafts, [:published_doc_id], prefix: @prefix))
    create(index(:doc_drafts, [:author_id], prefix: @prefix))
    create(unique_index(:doc_drafts, [:community_id, :slug], prefix: @prefix))
    create(unique_index(:doc_drafts, [:community_id, :template_key], prefix: @prefix))

    create table(:doc_document_drafts, prefix: @prefix) do
      add(:doc_draft_id, references(:doc_drafts, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:json, :text, null: false)
      add(:markdown, :text)
      add(:markdown_toc, :map)
      add(:html, :text)
      add(:xml, :text)
      add(:rss, :text)
      add(:plain_text, :text)
      add(:digest, :text)
      add(:content_hash, :string)
      add(:schema_version, :integer, null: false, default: 1)

      timestamps()
    end

    create(unique_index(:doc_document_drafts, [:doc_draft_id], prefix: @prefix))

    create table(:doc_tree_nodes, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:parent_id, references(:doc_tree_nodes, prefix: @prefix, on_delete: :delete_all))
      add(:doc_id, references(:docs, prefix: @prefix, on_delete: :nilify_all))

      add(:type, :string, null: false)
      add(:title, :string, null: false)
      add(:slug, :string, null: false)
      add(:index, :integer, null: false, default: 0)
      add(:href, :string)
      add(:icon, :map)
      add(:badge, :string)
      add(:hidden, :boolean, null: false, default: false)
      add(:expanded, :boolean, null: false, default: true)

      timestamps()
    end

    create(index(:doc_tree_nodes, [:community_id], prefix: @prefix))
    create(index(:doc_tree_nodes, [:parent_id], prefix: @prefix))
    create(index(:doc_tree_nodes, [:doc_id], prefix: @prefix))

    create(
      unique_index(:doc_tree_nodes, [:community_id, :slug],
        prefix: @prefix,
        where: "parent_id IS NULL",
        name: :doc_tree_nodes_root_slug_index
      )
    )

    create(
      unique_index(:doc_tree_nodes, [:community_id, :title],
        prefix: @prefix,
        where: "parent_id IS NULL",
        name: :doc_tree_nodes_root_title_index
      )
    )

    create(
      unique_index(:doc_tree_nodes, [:community_id, :parent_id, :slug],
        prefix: @prefix,
        where: "parent_id IS NOT NULL",
        name: :doc_tree_nodes_sibling_slug_index
      )
    )

    create(
      unique_index(:doc_tree_nodes, [:community_id, :parent_id, :title],
        prefix: @prefix,
        where: "parent_id IS NOT NULL",
        name: :doc_tree_nodes_sibling_title_index
      )
    )

    create table(:doc_tree_node_drafts, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:parent_id, references(:doc_tree_node_drafts, prefix: @prefix, on_delete: :delete_all))
      add(:doc_draft_id, references(:doc_drafts, prefix: @prefix, on_delete: :nilify_all))

      add(:type, :string, null: false)
      add(:title, :string, null: false)
      add(:slug, :string, null: false)
      add(:index, :integer, null: false, default: 0)
      add(:href, :string)
      add(:icon, :map)
      add(:badge, :string)
      add(:hidden, :boolean, null: false, default: false)
      add(:expanded, :boolean, null: false, default: true)
      add(:template_key, :string)

      timestamps()
    end

    create(index(:doc_tree_node_drafts, [:community_id], prefix: @prefix))
    create(index(:doc_tree_node_drafts, [:parent_id], prefix: @prefix))
    create(index(:doc_tree_node_drafts, [:doc_draft_id], prefix: @prefix))
    create(unique_index(:doc_tree_node_drafts, [:community_id, :template_key], prefix: @prefix))

    create(
      unique_index(:doc_tree_node_drafts, [:community_id, :slug],
        prefix: @prefix,
        where: "parent_id IS NULL",
        name: :doc_tree_node_drafts_root_slug_index
      )
    )

    create(
      unique_index(:doc_tree_node_drafts, [:community_id, :title],
        prefix: @prefix,
        where: "parent_id IS NULL",
        name: :doc_tree_node_drafts_root_title_index
      )
    )

    create(
      unique_index(:doc_tree_node_drafts, [:community_id, :parent_id, :slug],
        prefix: @prefix,
        where: "parent_id IS NOT NULL",
        name: :doc_tree_node_drafts_sibling_slug_index
      )
    )

    create(
      unique_index(:doc_tree_node_drafts, [:community_id, :parent_id, :title],
        prefix: @prefix,
        where: "parent_id IS NOT NULL",
        name: :doc_tree_node_drafts_sibling_title_index
      )
    )
  end
end
