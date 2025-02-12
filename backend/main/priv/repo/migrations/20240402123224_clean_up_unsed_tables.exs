defmodule GroupherServer.Repo.Migrations.CleanUpUnsedTables do
  use Ecto.Migration

  def change do
    drop table(:tags)
    drop table(:articles_comments_users_emotions)
    drop table(:articles_comments_replies)
    drop table(:articles_comments_upvotes)
    drop table(:articles_pinned_comments)
  end
end
