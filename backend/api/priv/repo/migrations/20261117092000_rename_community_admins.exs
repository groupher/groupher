defmodule GroupherServer.Repo.Migrations.RenameCommunityAdmins do
  use Ecto.Migration

  def up do
    rename(table(:communities_moderators, prefix: "cms"),
      to: table(:communities_admins, prefix: "cms")
    )

    alter table(:communities_admins, prefix: "cms") do
      add(:is_lord, :boolean, null: false, default: false)
      add(:permissions, :map, null: false, default: %{})
      add(:revision, :bigint, null: false, default: 1)
      add(:joined_at, :timestamptz)
    end

    execute("UPDATE cms.communities_admins SET joined_at = inserted_at WHERE joined_at IS NULL")
    execute("ALTER TABLE cms.communities_admins ALTER COLUMN joined_at SET NOT NULL")

    execute(
      "ALTER TABLE cms.communities_admins ALTER COLUMN joined_at SET DEFAULT CURRENT_TIMESTAMP"
    )

    execute(
      "ALTER TABLE cms.communities_admins DROP CONSTRAINT communities_editors_community_id_fkey"
    )

    execute(
      "ALTER TABLE cms.communities_admins ADD CONSTRAINT communities_admins_community_id_fkey FOREIGN KEY (community_id) REFERENCES cms.communities(id) ON DELETE RESTRICT"
    )

    execute("ALTER TABLE cms.communities_admins DROP CONSTRAINT communities_editors_user_id_fkey")

    execute(
      "ALTER TABLE cms.communities_admins ADD CONSTRAINT communities_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES account.users(id) ON DELETE RESTRICT"
    )

    create(
      constraint(:communities_admins, :communities_admins_revision_check,
        prefix: "cms",
        check: "revision > 0"
      )
    )
  end

  def down do
    drop(constraint(:communities_admins, :communities_admins_revision_check, prefix: "cms"))
    execute("ALTER TABLE cms.communities_admins DROP CONSTRAINT communities_admins_user_id_fkey")

    execute(
      "ALTER TABLE cms.communities_admins ADD CONSTRAINT communities_editors_user_id_fkey FOREIGN KEY (user_id) REFERENCES account.users(id) ON DELETE CASCADE"
    )

    execute(
      "ALTER TABLE cms.communities_admins DROP CONSTRAINT communities_admins_community_id_fkey"
    )

    execute(
      "ALTER TABLE cms.communities_admins ADD CONSTRAINT communities_editors_community_id_fkey FOREIGN KEY (community_id) REFERENCES cms.communities(id) ON DELETE CASCADE"
    )

    alter table(:communities_admins, prefix: "cms") do
      remove(:joined_at)
      remove(:revision)
      remove(:permissions)
      remove(:is_lord)
    end

    rename(table(:communities_admins, prefix: "cms"),
      to: table(:communities_moderators, prefix: "cms")
    )
  end
end
