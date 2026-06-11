defmodule GroupherServer.Repo.Migrations.NestCoverBackgroundBgFeatures do
  use Ecto.Migration

  @prefix "cms"

  def up do
    alter table(:cover_backgrounds, prefix: @prefix) do
      add(:pattern, :map)
      add(:content_shadow, :map)
      add(:effect, :map)
    end

    execute("""
    UPDATE #{@prefix}.cover_backgrounds
    SET
      pattern = jsonb_build_object(
        'enabled', COALESCE(to_jsonb(has_pattern), 'true'::jsonb),
        'id', COALESCE(to_jsonb(pattern_id), to_jsonb('01'::text)),
        'intensity', COALESCE(to_jsonb(pattern_intensity), to_jsonb(50)),
        'tone', COALESCE(to_jsonb(pattern_tone), to_jsonb('dark'::text))
      ),
      content_shadow = jsonb_build_object(
        'enabled', COALESCE(to_jsonb(has_shadow), 'false'::jsonb)
      ),
      effect = jsonb_build_object(
        'blurIntensity', COALESCE(to_jsonb(blur_intensity), to_jsonb(0)),
        'brightness', COALESCE(to_jsonb(brightness), to_jsonb(100)),
        'saturation', COALESCE(to_jsonb(saturation), to_jsonb(100))
      ),
      texture =
        CASE
          WHEN COALESCE(texture, '{}'::jsonb) ? 'enabled' THEN texture
          ELSE COALESCE(texture, '{"type":"noise","intensity":0,"params":{}}'::jsonb)
            || jsonb_build_object('enabled', COALESCE(to_jsonb(has_texture), 'false'::jsonb))
        END
    """)

    alter table(:cover_backgrounds, prefix: @prefix) do
      remove(:has_pattern)
      remove(:pattern_id)
      remove(:pattern_intensity)
      remove(:pattern_tone)
      remove(:has_texture)
      remove(:blur_intensity)
      remove(:has_shadow)
      remove(:brightness)
      remove(:saturation)
    end
  end

  def down, do: :ok
end
