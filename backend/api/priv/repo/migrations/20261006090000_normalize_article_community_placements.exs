defmodule GroupherServer.Repo.Migrations.NormalizeArticleCommunityPlacements do
  use Ecto.Migration

  @prefix "cms"

  def up do
    drop_if_exists(
      index(:article_communities, [:article_id],
        prefix: @prefix,
        name: :article_communities_home_index
      )
    )

    execute(
      "ALTER TABLE #{@prefix}.article_communities " <>
        "DROP CONSTRAINT IF EXISTS article_communities_role_check"
    )

    alter table(:article_communities, prefix: @prefix) do
      remove(:role)
    end
  end

  def down do
    alter table(:article_communities, prefix: @prefix) do
      add(:role, :string, null: false, default: "mirror")
    end

    execute(
      "ALTER TABLE #{@prefix}.article_communities " <>
        "ADD CONSTRAINT article_communities_role_check " <>
        "CHECK (role IN ('home', 'mirror'))"
    )

    create(
      unique_index(:article_communities, [:article_id],
        prefix: @prefix,
        where: "role = 'home'",
        name: :article_communities_home_index
      )
    )
  end
end
