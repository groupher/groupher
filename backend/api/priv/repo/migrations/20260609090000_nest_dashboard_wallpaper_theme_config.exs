defmodule GroupherServer.Repo.Migrations.NestDashboardWallpaperThemeConfig do
  use Ecto.Migration

  def up do
    execute("""
    UPDATE cms.community_dashboards
    SET wallpaper = jsonb_build_object(
      'light',
      jsonb_strip_nulls(jsonb_build_object(
        'type', COALESCE(wallpaper->'light'->'type', wallpaper->'type'),
        'source', COALESCE(wallpaper->'light'->'source', wallpaper->'source'),
        'has_pattern', COALESCE(wallpaper->'light'->'has_pattern', wallpaper->'has_pattern'),
        'pattern_id', COALESCE(wallpaper->'light'->'pattern_id', wallpaper->'pattern_id'),
        'pattern_intensity',
        COALESCE(wallpaper->'light'->'pattern_intensity', wallpaper->'pattern_intensity'),
        'pattern_tone', COALESCE(wallpaper->'light'->'pattern_tone', wallpaper->'pattern_tone'),
        'has_texture', COALESCE(wallpaper->'light'->'has_texture', wallpaper->'has_texture'),
        'gradient', COALESCE(wallpaper->'light'->'gradient', wallpaper->'gradient'),
        'blur_intensity',
        COALESCE(wallpaper->'light'->'blur_intensity', wallpaper->'blur_intensity'),
        'has_shadow', COALESCE(wallpaper->'light'->'has_shadow', wallpaper->'has_shadow'),
        'brightness', COALESCE(wallpaper->'light'->'brightness', wallpaper->'brightness'),
        'saturation', COALESCE(wallpaper->'light'->'saturation', wallpaper->'saturation'),
        'texture', COALESCE(wallpaper->'light'->'texture', wallpaper->'texture')
      )),
      'dark',
      jsonb_strip_nulls(jsonb_build_object(
        'type', COALESCE(wallpaper->'dark'->'type', wallpaper->'type_dark'),
        'source', COALESCE(wallpaper->'dark'->'source', wallpaper->'source_dark'),
        'has_pattern', COALESCE(wallpaper->'dark'->'has_pattern', wallpaper->'has_pattern_dark'),
        'pattern_id', COALESCE(wallpaper->'dark'->'pattern_id', wallpaper->'pattern_id_dark'),
        'pattern_intensity',
        COALESCE(wallpaper->'dark'->'pattern_intensity', wallpaper->'pattern_intensity_dark'),
        'pattern_tone', COALESCE(wallpaper->'dark'->'pattern_tone', wallpaper->'pattern_tone_dark'),
        'has_texture', COALESCE(wallpaper->'dark'->'has_texture', wallpaper->'has_texture_dark'),
        'gradient', COALESCE(wallpaper->'dark'->'gradient', wallpaper->'gradient_dark'),
        'blur_intensity',
        COALESCE(wallpaper->'dark'->'blur_intensity', wallpaper->'blur_intensity_dark'),
        'has_shadow', COALESCE(wallpaper->'dark'->'has_shadow', wallpaper->'has_shadow_dark'),
        'brightness', COALESCE(wallpaper->'dark'->'brightness', wallpaper->'brightness_dark'),
        'saturation', COALESCE(wallpaper->'dark'->'saturation', wallpaper->'saturation_dark'),
        'texture', COALESCE(wallpaper->'dark'->'texture', wallpaper->'texture_dark')
      ))
    )
    WHERE wallpaper IS NOT NULL
      AND (
        NOT (wallpaper ? 'light')
        OR NOT (wallpaper ? 'dark')
      )
    """)
  end

  def down do
    execute("""
    UPDATE cms.community_dashboards
    SET wallpaper = jsonb_strip_nulls(jsonb_build_object(
      'type', COALESCE(wallpaper->'light'->'type', wallpaper->'type'),
      'source', COALESCE(wallpaper->'light'->'source', wallpaper->'source'),
      'type_dark', COALESCE(wallpaper->'dark'->'type', wallpaper->'type_dark'),
      'source_dark', COALESCE(wallpaper->'dark'->'source', wallpaper->'source_dark'),
      'has_pattern',
      COALESCE(wallpaper->'light'->'has_pattern', wallpaper->'has_pattern'),
      'pattern_id',
      COALESCE(wallpaper->'light'->'pattern_id', wallpaper->'pattern_id'),
      'pattern_intensity',
      COALESCE(wallpaper->'light'->'pattern_intensity', wallpaper->'pattern_intensity'),
      'pattern_tone',
      COALESCE(wallpaper->'light'->'pattern_tone', wallpaper->'pattern_tone'),
      'has_texture',
      COALESCE(wallpaper->'light'->'has_texture', wallpaper->'has_texture'),
      'has_pattern_dark',
      COALESCE(wallpaper->'dark'->'has_pattern', wallpaper->'has_pattern_dark'),
      'pattern_id_dark',
      COALESCE(wallpaper->'dark'->'pattern_id', wallpaper->'pattern_id_dark'),
      'pattern_intensity_dark',
      COALESCE(wallpaper->'dark'->'pattern_intensity', wallpaper->'pattern_intensity_dark'),
      'pattern_tone_dark',
      COALESCE(wallpaper->'dark'->'pattern_tone', wallpaper->'pattern_tone_dark'),
      'has_texture_dark',
      COALESCE(wallpaper->'dark'->'has_texture', wallpaper->'has_texture_dark'),
      'gradient',
      COALESCE(wallpaper->'light'->'gradient', wallpaper->'gradient'),
      'gradient_dark',
      COALESCE(wallpaper->'dark'->'gradient', wallpaper->'gradient_dark'),
      'blur_intensity',
      COALESCE(wallpaper->'light'->'blur_intensity', wallpaper->'blur_intensity'),
      'has_shadow',
      COALESCE(wallpaper->'light'->'has_shadow', wallpaper->'has_shadow'),
      'brightness',
      COALESCE(wallpaper->'light'->'brightness', wallpaper->'brightness'),
      'saturation',
      COALESCE(wallpaper->'light'->'saturation', wallpaper->'saturation'),
      'blur_intensity_dark',
      COALESCE(wallpaper->'dark'->'blur_intensity', wallpaper->'blur_intensity_dark'),
      'has_shadow_dark',
      COALESCE(wallpaper->'dark'->'has_shadow', wallpaper->'has_shadow_dark'),
      'brightness_dark',
      COALESCE(wallpaper->'dark'->'brightness', wallpaper->'brightness_dark'),
      'saturation_dark',
      COALESCE(wallpaper->'dark'->'saturation', wallpaper->'saturation_dark'),
      'texture',
      COALESCE(wallpaper->'light'->'texture', wallpaper->'texture'),
      'texture_dark',
      COALESCE(wallpaper->'dark'->'texture', wallpaper->'texture_dark')
    ))
    WHERE wallpaper IS NOT NULL
      AND (wallpaper ? 'light' OR wallpaper ? 'dark')
    """)
  end
end
