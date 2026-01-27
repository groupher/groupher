defmodule GroupherServer.Repo.Migrations.RemoveGeoInfoFromCommunities do
  use Ecto.Migration

  def up do
    execute("ALTER TABLE IF EXISTS cms.communities DROP COLUMN IF EXISTS geo_info")
    execute("ALTER TABLE IF EXISTS public.communities DROP COLUMN IF EXISTS geo_info")
  end

  def down do
    execute("ALTER TABLE IF EXISTS cms.communities ADD COLUMN IF NOT EXISTS geo_info jsonb")
    execute("ALTER TABLE IF EXISTS public.communities ADD COLUMN IF NOT EXISTS geo_info jsonb")
  end
end
