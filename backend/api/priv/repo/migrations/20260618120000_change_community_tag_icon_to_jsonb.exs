defmodule GroupherServer.Repo.Migrations.ChangeCommunityTagIconToJsonb do
  use Ecto.Migration

  def up do
    execute("""
    ALTER TABLE cms.community_tags
    ALTER COLUMN icon TYPE jsonb
    USING (
      CASE
        WHEN icon IS NULL OR btrim(icon) = '' THEN NULL
        ELSE jsonb_build_object(
          'type', 'icon',
          'provider', 'lucide',
          'name', icon,
          'src', icon
        )
      END
    )
    """)
  end

  def down do
    execute("""
    ALTER TABLE cms.community_tags
    ALTER COLUMN icon TYPE varchar
    USING (
      CASE
        WHEN icon IS NULL THEN NULL
        ELSE COALESCE(icon->>'src', icon->>'name')
      END
    )
    """)
  end
end
