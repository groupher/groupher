defmodule GroupherServer.Repo.Migrations.CreateDraftCoverEdits do
  use Ecto.Migration

  @prefix "cms"

  def change do
    create table(:draft_cover_edits, primary_key: false, prefix: @prefix) do
      add(
        :body_draft_id,
        references(:article_body_drafts, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:canvas_width, :integer)
      add(:canvas_height, :integer)
      add(:version, :integer, null: false, default: 1)

      add(
        :light_background_id,
        references(:cover_backgrounds, prefix: @prefix, on_delete: :nilify_all)
      )

      add(
        :light_original_background_id,
        references(:cover_backgrounds, prefix: @prefix, on_delete: :nilify_all)
      )

      add(:light_images, {:array, :map}, null: false, default: [])

      add(
        :dark_background_id,
        references(:cover_backgrounds, prefix: @prefix, on_delete: :nilify_all)
      )

      add(
        :dark_original_background_id,
        references(:cover_backgrounds, prefix: @prefix, on_delete: :nilify_all)
      )

      add(:dark_images, {:array, :map}, null: false, default: [])
      timestamps()
    end
  end
end
