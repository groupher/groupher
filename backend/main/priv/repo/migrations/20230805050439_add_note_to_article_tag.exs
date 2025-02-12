defmodule GroupherServer.Repo.Migrations.AddNoteToArticleTag do
  use Ecto.Migration

  def change do
    alter table(:article_tags) do
      add(:desc, :string)
    end
  end
end
