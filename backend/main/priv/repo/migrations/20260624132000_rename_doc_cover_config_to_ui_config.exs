defmodule GroupherServer.Repo.Migrations.RenameDocCoverConfigToUiConfig do
  use Ecto.Migration

  @prefix "cms"

  def change do
    alter table(:doc_cover_groups, prefix: @prefix) do
      add_if_not_exists(:ui_config, :map, null: false, default: %{})
      remove_if_exists(:layout, :string)
    end

    alter table(:doc_cover_items, prefix: @prefix) do
      add_if_not_exists(:ui_config, :map, null: false, default: %{})
    end

    alter table(:doc_cover_pinned_items, prefix: @prefix) do
      add_if_not_exists(:ui_config, :map, null: false, default: %{})
      remove_if_exists(:visual_config, :map)
    end
  end
end
