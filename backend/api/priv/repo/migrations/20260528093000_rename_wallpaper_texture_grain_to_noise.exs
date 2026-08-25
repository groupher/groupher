defmodule GroupherServer.Repo.Migrations.RenameWallpaperTextureGrainToNoise do
  use Ecto.Migration

  @prefix "cms"

  def up do
    execute("""
    UPDATE #{@prefix}.community_dashboards
    SET wallpaper = jsonb_set(wallpaper, '{texture,type}', to_jsonb('noise'::text))
    WHERE wallpaper IS NOT NULL
      AND wallpaper->'texture'->>'type' = 'grain'
    """)
  end

  def down do
    execute("""
    UPDATE #{@prefix}.community_dashboards
    SET wallpaper = jsonb_set(wallpaper, '{texture,type}', to_jsonb('grain'::text))
    WHERE wallpaper IS NOT NULL
      AND wallpaper->'texture'->>'type' = 'noise'
    """)
  end
end
