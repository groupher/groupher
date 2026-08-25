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

    create(unique_index(:comments, [:id, :post_id], prefix: "cms"))
    create(unique_index(:post_solutions, [:post_id], prefix: "cms"))
    create(unique_index(:post_solutions, [:comment_id], prefix: "cms"))

    execute(
      """
      ALTER TABLE cms.post_solutions
      ADD CONSTRAINT post_solutions_comment_belongs_to_post_fkey
      FOREIGN KEY (comment_id, post_id)
      REFERENCES cms.comments (id, post_id)
      ON DELETE CASCADE
      """,
      """
      ALTER TABLE cms.post_solutions
      DROP CONSTRAINT IF EXISTS post_solutions_comment_belongs_to_post_fkey
      """
    )
  end
end
