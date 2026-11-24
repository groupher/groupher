defmodule GroupherServer.Repo.Migrations.RenameCommunityModeratorsToAdmins do
  use Ecto.Migration

  def up do
    rename(table(:communities, prefix: "cms"), :moderators_count, to: :admins_count)

    execute(
      "ALTER INDEX cms.communities_editors_user_id_community_id_index RENAME TO communities_admins_user_id_community_id_index"
    )

    execute("""
    UPDATE cms.communities
    SET meta = (meta - 'moderators_ids') || jsonb_build_object('admins_ids', meta->'moderators_ids')
    WHERE meta IS NOT NULL AND meta ? 'moderators_ids'
    """)
  end

  def down do
    execute("""
    UPDATE cms.communities
    SET meta = (meta - 'admins_ids') || jsonb_build_object('moderators_ids', meta->'admins_ids')
    WHERE meta IS NOT NULL AND meta ? 'admins_ids'
    """)

    rename(table(:communities, prefix: "cms"), :admins_count, to: :moderators_count)

    execute(
      "ALTER INDEX cms.communities_admins_user_id_community_id_index RENAME TO communities_editors_user_id_community_id_index"
    )
  end
end
