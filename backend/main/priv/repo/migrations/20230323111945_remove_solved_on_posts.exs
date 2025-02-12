defmodule GroupherServer.Repo.Migrations.RemoveSolvedOnPosts do
  use Ecto.Migration

  def change do
    alter table(:cms_posts) do
      remove(:is_question)
      remove(:is_solved)
    end
  end
end
