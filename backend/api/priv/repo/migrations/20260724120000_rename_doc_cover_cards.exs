defmodule GroupherServer.Repo.Migrations.RenameDocCoverCards do
  use Ecto.Migration

  @prefix "cms"

  def up do
    rename(table(:doc_cover_sections, prefix: @prefix), to: table(:doc_cover_cards))
    rename(table(:doc_cover_cards, prefix: @prefix), :source_node_id, to: :group_node_id)
    rename(table(:doc_cover_items, prefix: @prefix), :cover_section_id, to: :cover_card_id)

    execute(
      "ALTER INDEX #{@prefix}.doc_cover_sections_community_source_node_index RENAME TO doc_cover_cards_community_group_node_index"
    )

    execute(
      "ALTER INDEX #{@prefix}.doc_cover_items_cover_section_node_index RENAME TO doc_cover_items_cover_card_node_index"
    )

    execute(
      "ALTER TABLE #{@prefix}.doc_cover_cards RENAME CONSTRAINT doc_cover_groups_community_id_fkey TO doc_cover_cards_community_id_fkey"
    )

    execute(
      "ALTER TABLE #{@prefix}.doc_cover_cards RENAME CONSTRAINT doc_cover_groups_group_id_fkey TO doc_cover_cards_group_node_id_fkey"
    )

    execute(
      "ALTER TABLE #{@prefix}.doc_cover_items RENAME CONSTRAINT doc_cover_items_cover_group_id_fkey TO doc_cover_items_cover_card_id_fkey"
    )
  end

  def down do
    execute(
      "ALTER TABLE #{@prefix}.doc_cover_items RENAME CONSTRAINT doc_cover_items_cover_card_id_fkey TO doc_cover_items_cover_group_id_fkey"
    )

    execute(
      "ALTER TABLE #{@prefix}.doc_cover_cards RENAME CONSTRAINT doc_cover_cards_group_node_id_fkey TO doc_cover_groups_group_id_fkey"
    )

    execute(
      "ALTER TABLE #{@prefix}.doc_cover_cards RENAME CONSTRAINT doc_cover_cards_community_id_fkey TO doc_cover_groups_community_id_fkey"
    )

    execute(
      "ALTER INDEX #{@prefix}.doc_cover_items_cover_card_node_index RENAME TO doc_cover_items_cover_section_node_index"
    )

    execute(
      "ALTER INDEX #{@prefix}.doc_cover_cards_community_group_node_index RENAME TO doc_cover_sections_community_source_node_index"
    )

    rename(table(:doc_cover_items, prefix: @prefix), :cover_card_id, to: :cover_section_id)
    rename(table(:doc_cover_cards, prefix: @prefix), :group_node_id, to: :source_node_id)
    rename(table(:doc_cover_cards, prefix: @prefix), to: table(:doc_cover_sections))
  end
end
