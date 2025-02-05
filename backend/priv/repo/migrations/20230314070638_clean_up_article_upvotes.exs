defmodule GroupherServer.Repo.Migrations.CleanUpArticleUpvotes do
  use Ecto.Migration

  def change do
    drop_if_exists (unique_index(:article_upvotes, [:user_id, :meetup_id]))

    create(unique_index(:article_upvotes, [:user_id, :changelog_id]))
  end
end
