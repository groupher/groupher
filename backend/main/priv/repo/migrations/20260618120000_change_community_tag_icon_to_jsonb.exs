defmodule GroupherServer.Repo.Migrations.ChangeCommunityTagIconToJsonb do
  use Ecto.Migration

  def up do
    execute("ALTER TABLE cms.community_tags ALTER COLUMN icon TYPE jsonb USING NULL::jsonb")
  end

  def down do
    execute("ALTER TABLE cms.community_tags ALTER COLUMN icon TYPE varchar USING NULL::varchar")
  end
end
