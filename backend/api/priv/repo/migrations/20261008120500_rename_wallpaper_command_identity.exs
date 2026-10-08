defmodule GroupherServer.Repo.Migrations.RenameWallpaperCommandIdentity do
  use Ecto.Migration

  @prefix "cms"

  def change do
    rename table(:wallpaper_publish_receipts, prefix: @prefix),
      :idempotency_key,
      to: :command_id

    rename index(:wallpaper_publish_receipts, [:community_id, :idempotency_key],
      prefix: @prefix,
      name: :wallpaper_publish_receipts_community_id_idempotency_key_index
    ),
      to: :wallpaper_publish_receipts_community_id_command_id_index
  end
end
