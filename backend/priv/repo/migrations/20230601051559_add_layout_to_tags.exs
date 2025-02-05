defmodule GroupherServer.Repo.Migrations.AddLayoutToTags do
  use Ecto.Migration

  def change do
    alter table(:article_tags) do
      add(:layout, :string)
    end
  end
end
