defmodule GroupherServer.Repo.Migrations.ReplaceRemovedWallpaperTextures do
  use Ecto.Migration

  @prefix "cms"

  def up do
    execute("""
    UPDATE #{@prefix}.community_dashboards
    SET wallpaper = jsonb_set(wallpaper, '{texture,type}', to_jsonb('tile'::text))
    WHERE wallpaper IS NOT NULL
      AND wallpaper->'texture'->>'type' = 'pixelate'
    """)

    execute("""
    UPDATE #{@prefix}.community_dashboards
    SET wallpaper = jsonb_set(wallpaper, '{texture,type}', to_jsonb('dots'::text))
    WHERE wallpaper IS NOT NULL
      AND wallpaper->'texture'->>'type' = 'screentone'
    """)
  end

  def down do
    execute("""
    UPDATE #{@prefix}.community_dashboards
    SET wallpaper = jsonb_set(wallpaper, '{texture,type}', to_jsonb('pixelate'::text))
    WHERE wallpaper IS NOT NULL
      AND wallpaper->'texture'->>'type' = 'tile'
    """)

    execute("""
    UPDATE #{@prefix}.community_dashboards
    SET wallpaper = jsonb_set(wallpaper, '{texture,type}', to_jsonb('screentone'::text))
    WHERE wallpaper IS NOT NULL
      AND wallpaper->'texture'->>'type' = 'dots'
    """)
  end
end
