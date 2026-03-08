defmodule GroupherServer.Repo.Migrations.AddUniqueIndexToAchievementsUserId do
  use Ecto.Migration

  def up do
    execute("""
    DELETE FROM account.achievements a
    USING account.achievements b
    WHERE a.user_id = b.user_id
      AND a.id < b.id
    """)

    execute("DROP INDEX IF EXISTS account.user_achievements_user_id_index")

    create(
      unique_index(:achievements, [:user_id],
        name: :achievements_user_id_index,
        prefix: "account"
      )
    )
  end

  def down do
    drop_if_exists(
      index(:achievements, [:user_id], name: :achievements_user_id_index, prefix: "account")
    )

    create(index(:achievements, [:user_id], prefix: "account"))
  end
end
