defmodule GroupherServer.Repo.Migrations.NestDashboardWallpaperThemeConfig do
  use Ecto.Migration

  def up do
    execute("""
    UPDATE cms.community_dashboards
    SET wallpaper = jsonb_build_object(
      'light',
      jsonb_strip_nulls(jsonb_build_object(
        'type', wallpaper->'type',
        'source', wallpaper->'source',
        'has_pattern', wallpaper->'has_pattern',
        'pattern_id', wallpaper->'pattern_id',
        'pattern_intensity', wallpaper->'pattern_intensity',
        'pattern_tone', wallpaper->'pattern_tone',
        'has_texture', wallpaper->'has_texture',
        'gradient', wallpaper->'gradient',
        'blur_intensity', wallpaper->'blur_intensity',
        'has_shadow', wallpaper->'has_shadow',
        'brightness', wallpaper->'brightness',
        'saturation', wallpaper->'saturation',
        'texture', wallpaper->'texture'
      )),
      'dark',
      jsonb_strip_nulls(jsonb_build_object(
        'type', wallpaper->'type_dark',
        'source', wallpaper->'source_dark',
        'has_pattern', wallpaper->'has_pattern_dark',
        'pattern_id', wallpaper->'pattern_id_dark',
        'pattern_intensity', wallpaper->'pattern_intensity_dark',
        'pattern_tone', wallpaper->'pattern_tone_dark',
        'has_texture', wallpaper->'has_texture_dark',
        'gradient', wallpaper->'gradient_dark',
        'blur_intensity', wallpaper->'blur_intensity_dark',
        'has_shadow', wallpaper->'has_shadow_dark',
        'brightness', wallpaper->'brightness_dark',
        'saturation', wallpaper->'saturation_dark',
        'texture', wallpaper->'texture_dark'
      ))
    )
    WHERE wallpaper IS NOT NULL
      AND NOT wallpaper ? 'light'
      AND NOT wallpaper ? 'dark'
    """)
  end

  def down do
    execute("""
    UPDATE cms.community_dashboards
    SET wallpaper = jsonb_strip_nulls(jsonb_build_object(
      'type', wallpaper->'light'->'type',
      'source', wallpaper->'light'->'source',
      'type_dark', wallpaper->'dark'->'type',
      'source_dark', wallpaper->'dark'->'source',
      'has_pattern', wallpaper->'light'->'has_pattern',
      'pattern_id', wallpaper->'light'->'pattern_id',
      'pattern_intensity', wallpaper->'light'->'pattern_intensity',
      'pattern_tone', wallpaper->'light'->'pattern_tone',
      'has_texture', wallpaper->'light'->'has_texture',
      'has_pattern_dark', wallpaper->'dark'->'has_pattern',
      'pattern_id_dark', wallpaper->'dark'->'pattern_id',
      'pattern_intensity_dark', wallpaper->'dark'->'pattern_intensity',
      'pattern_tone_dark', wallpaper->'dark'->'pattern_tone',
      'has_texture_dark', wallpaper->'dark'->'has_texture',
      'gradient', wallpaper->'light'->'gradient',
      'gradient_dark', wallpaper->'dark'->'gradient',
      'blur_intensity', wallpaper->'light'->'blur_intensity',
      'has_shadow', wallpaper->'light'->'has_shadow',
      'brightness', wallpaper->'light'->'brightness',
      'saturation', wallpaper->'light'->'saturation',
      'blur_intensity_dark', wallpaper->'dark'->'blur_intensity',
      'has_shadow_dark', wallpaper->'dark'->'has_shadow',
      'brightness_dark', wallpaper->'dark'->'brightness',
      'saturation_dark', wallpaper->'dark'->'saturation',
      'texture', wallpaper->'light'->'texture',
      'texture_dark', wallpaper->'dark'->'texture'
    ))
    WHERE wallpaper IS NOT NULL
      AND wallpaper ? 'light'
      AND wallpaper ? 'dark'
    """)
  end
end
