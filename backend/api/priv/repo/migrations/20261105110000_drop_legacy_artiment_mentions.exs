defmodule GroupherServer.Repo.Migrations.DropLegacyArtimentMentions do
  use Ecto.Migration

  @prefix "cms"

  def up do
    drop_if_exists(table(:reference_map_revisions, prefix: @prefix))
    drop_if_exists(table(:artiment_mention_sync_states, prefix: @prefix))
    drop_if_exists(table(:artiment_mentions, prefix: @prefix))

    execute("DROP FUNCTION IF EXISTS cms.validate_mention_resource_ownership()")
    execute("DROP FUNCTION IF EXISTS cms.prepare_artiment_mention()")
    execute("DROP FUNCTION IF EXISTS cms.mention_key_part(text)")
  end

  def down do
    raise "legacy Article Mention data is intentionally not restorable"
  end
end
