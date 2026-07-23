defmodule GroupherServer.Repo.Migrations.RefactorDocCoverPinnedDocs do
  use Ecto.Migration

  @prefix "cms"

  def up do
    rename(table(:doc_cover_pinned_items, prefix: @prefix),
      to: table(:doc_cover_pinned_docs, prefix: @prefix)
    )

    rename(table(:doc_cover_pinned_docs, prefix: @prefix), :ui_config, to: :appearance)

    alter table(:doc_cover_pinned_docs, prefix: @prefix) do
      modify(:appearance, :map,
        null: false,
        default: %{"light" => %{}, "dark" => %{}}
      )
    end

    execute(
      "ALTER INDEX #{@prefix}.doc_cover_pinned_items_community_id_index RENAME TO doc_cover_pinned_docs_community_id_index"
    )

    execute(
      "ALTER INDEX #{@prefix}.doc_cover_pinned_items_node_id_index RENAME TO doc_cover_pinned_docs_node_id_index"
    )

    execute(
      "ALTER INDEX #{@prefix}.doc_cover_pinned_items_community_node_index RENAME TO doc_cover_pinned_docs_community_node_index"
    )

    execute(
      "UPDATE #{@prefix}.doc_cover_pinned_docs SET appearance = jsonb_build_object('light', appearance, 'dark', appearance)"
    )

    create(
      constraint(:doc_cover_pinned_docs, :doc_cover_pinned_docs_index_non_negative,
        prefix: @prefix,
        check: "\"index\" >= 0"
      )
    )

    alter table(:article_documents, prefix: @prefix) do
      add(:thumbnail, :map)
    end
  end

  def down do
    alter table(:article_documents, prefix: @prefix) do
      remove(:thumbnail, :map)
    end

    drop(
      constraint(:doc_cover_pinned_docs, :doc_cover_pinned_docs_index_non_negative,
        prefix: @prefix
      )
    )

    execute(
      "UPDATE #{@prefix}.doc_cover_pinned_docs SET appearance = COALESCE(appearance->'light', '{}'::jsonb)"
    )

    alter table(:doc_cover_pinned_docs, prefix: @prefix) do
      modify(:appearance, :map, null: false, default: %{})
    end

    execute(
      "ALTER INDEX #{@prefix}.doc_cover_pinned_docs_community_id_index RENAME TO doc_cover_pinned_items_community_id_index"
    )

    execute(
      "ALTER INDEX #{@prefix}.doc_cover_pinned_docs_node_id_index RENAME TO doc_cover_pinned_items_node_id_index"
    )

    execute(
      "ALTER INDEX #{@prefix}.doc_cover_pinned_docs_community_node_index RENAME TO doc_cover_pinned_items_community_node_index"
    )

    rename(table(:doc_cover_pinned_docs, prefix: @prefix), :appearance, to: :ui_config)

    rename(table(:doc_cover_pinned_docs, prefix: @prefix),
      to: table(:doc_cover_pinned_items, prefix: @prefix)
    )
  end
end
