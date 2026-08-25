defmodule GroupherServer.Repo.Migrations.AddWallpaperHasTexture do
  use Ecto.Migration

  @prefix "cms"

  def up do
    execute("""
    UPDATE #{@prefix}.community_dashboards
    SET wallpaper = jsonb_set(
      wallpaper,
      '{has_texture}',
      to_jsonb(COALESCE((wallpaper->'texture'->>'intensity')::int, 0) > 0)
    )
    WHERE wallpaper IS NOT NULL
      AND NOT wallpaper ? 'has_texture'
    """)
  end

  def down do
    execute("""
    UPDATE #{@prefix}.community_dashboards
    SET wallpaper = wallpaper - 'has_texture'
    WHERE wallpaper IS NOT NULL
    """)
  end
end
