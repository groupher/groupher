defmodule GroupherServer.Repo.Migrations.CreatePostSolutions do
  use Ecto.Migration

  def change do
    create table(:post_solutions, prefix: "cms") do
      add(:post_id, references(:posts, prefix: "cms", on_delete: :delete_all), null: false)
      add(:comment_id, references(:comments, prefix: "cms", on_delete: :delete_all), null: false)

      add(:accepted_by_id, references(:users, prefix: "account", on_delete: :nilify_all),
        null: true
      )

      add(:accepted_at, :timestamptz, null: false)
      timestamps()
    end

    create(unique_index(:post_solutions, [:post_id], prefix: "cms"))
    create(index(:post_solutions, [:comment_id], prefix: "cms"))
  end
end
