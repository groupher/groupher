defmodule GroupherServer.Repo.Migrations.NestDashboardWallpaperBgFeatures do
  use Ecto.Migration

  def up do
    execute("""
    UPDATE cms.community_dashboards
    SET wallpaper = jsonb_build_object(
      'light',
      jsonb_strip_nulls(jsonb_build_object(
        'type', COALESCE(wallpaper->'light'->'type', wallpaper->'type', to_jsonb('gradient'::text)),
        'source', COALESCE(wallpaper->'light'->'source', wallpaper->'source', to_jsonb('amber_mauve'::text)),
        'pattern',
        COALESCE(
          wallpaper->'light'->'pattern',
          jsonb_build_object(
            'enabled', COALESCE(wallpaper->'light'->'has_pattern', wallpaper->'has_pattern', 'true'::jsonb),
            'id', COALESCE(wallpaper->'light'->'pattern_id', wallpaper->'pattern_id', to_jsonb('01'::text)),
            'intensity', COALESCE(wallpaper->'light'->'pattern_intensity', wallpaper->'pattern_intensity', to_jsonb(50)),
            'tone', COALESCE(wallpaper->'light'->'pattern_tone', wallpaper->'pattern_tone', to_jsonb('dark'::text))
          )
        ),
        'gradient', COALESCE(wallpaper->'light'->'gradient', wallpaper->'gradient'),
        'content_shadow',
        COALESCE(
          wallpaper->'light'->'content_shadow',
          jsonb_build_object(
            'enabled', COALESCE(wallpaper->'light'->'has_shadow', wallpaper->'has_shadow', 'false'::jsonb)
          )
        ),
        'effect',
        COALESCE(
          wallpaper->'light'->'effect',
          jsonb_build_object(
            'blurIntensity', COALESCE(wallpaper->'light'->'blur_intensity', wallpaper->'blur_intensity', to_jsonb(0)),
            'brightness', COALESCE(wallpaper->'light'->'brightness', wallpaper->'brightness', to_jsonb(100)),
            'saturation', COALESCE(wallpaper->'light'->'saturation', wallpaper->'saturation', to_jsonb(100))
          )
        ),
        'texture',
        CASE
          WHEN COALESCE(wallpaper->'light'->'texture', wallpaper->'texture', '{}'::jsonb) ? 'enabled' THEN
            COALESCE(wallpaper->'light'->'texture', wallpaper->'texture')
          ELSE
            COALESCE(wallpaper->'light'->'texture', wallpaper->'texture', '{"type":"noise","intensity":0,"params":{}}'::jsonb)
            || jsonb_build_object(
              'enabled', COALESCE(wallpaper->'light'->'has_texture', wallpaper->'has_texture', 'false'::jsonb)
            )
        END
      )),
      'dark',
      jsonb_strip_nulls(jsonb_build_object(
        'type', COALESCE(wallpaper->'dark'->'type', wallpaper->'type_dark', wallpaper->'type', to_jsonb('gradient'::text)),
        'source', COALESCE(wallpaper->'dark'->'source', wallpaper->'source_dark', wallpaper->'source', to_jsonb('amber_mauve'::text)),
        'pattern',
        COALESCE(
          wallpaper->'dark'->'pattern',
          jsonb_build_object(
            'enabled', COALESCE(wallpaper->'dark'->'has_pattern', wallpaper->'has_pattern_dark', wallpaper->'has_pattern', 'true'::jsonb),
            'id', COALESCE(wallpaper->'dark'->'pattern_id', wallpaper->'pattern_id_dark', wallpaper->'pattern_id', to_jsonb('01'::text)),
            'intensity', COALESCE(wallpaper->'dark'->'pattern_intensity', wallpaper->'pattern_intensity_dark', wallpaper->'pattern_intensity', to_jsonb(50)),
            'tone', COALESCE(wallpaper->'dark'->'pattern_tone', wallpaper->'pattern_tone_dark', wallpaper->'pattern_tone', to_jsonb('dark'::text))
          )
        ),
        'gradient', COALESCE(wallpaper->'dark'->'gradient', wallpaper->'gradient_dark', wallpaper->'gradient'),
        'content_shadow',
        COALESCE(
          wallpaper->'dark'->'content_shadow',
          jsonb_build_object(
            'enabled', COALESCE(wallpaper->'dark'->'has_shadow', wallpaper->'has_shadow_dark', wallpaper->'has_shadow', 'false'::jsonb)
          )
        ),
        'effect',
        COALESCE(
          wallpaper->'dark'->'effect',
          jsonb_build_object(
            'blurIntensity', COALESCE(wallpaper->'dark'->'blur_intensity', wallpaper->'blur_intensity_dark', wallpaper->'blur_intensity', to_jsonb(0)),
            'brightness', COALESCE(wallpaper->'dark'->'brightness', wallpaper->'brightness_dark', wallpaper->'brightness', to_jsonb(100)),
            'saturation', COALESCE(wallpaper->'dark'->'saturation', wallpaper->'saturation_dark', wallpaper->'saturation', to_jsonb(100))
          )
        ),
        'texture',
        CASE
          WHEN COALESCE(wallpaper->'dark'->'texture', wallpaper->'texture_dark', wallpaper->'texture', '{}'::jsonb) ? 'enabled' THEN
            COALESCE(wallpaper->'dark'->'texture', wallpaper->'texture_dark', wallpaper->'texture')
          ELSE
            COALESCE(wallpaper->'dark'->'texture', wallpaper->'texture_dark', wallpaper->'texture', '{"type":"noise","intensity":0,"params":{}}'::jsonb)
            || jsonb_build_object(
              'enabled', COALESCE(wallpaper->'dark'->'has_texture', wallpaper->'has_texture_dark', wallpaper->'has_texture', 'false'::jsonb)
            )
        END
      ))
    )
    WHERE wallpaper IS NOT NULL
    """)
  end

  def down, do: :ok
end
