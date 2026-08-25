defmodule GroupherServer.Repo.Migrations.CleanUpUnusedTables do
  use Ecto.Migration

  def change do
    drop table(:posts_comments_replies)
    drop table(:posts_comments_likes)
    drop table(:posts_comments)
    drop table(:posts_tags)
  end
end
