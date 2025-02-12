defmodule GroupherServer.Repo.Migrations.AddIndexToTag do
  use Ecto.Migration

  def change do
    alter table(:article_tags) do
      add(:index, :integer, default: 0)
    end
  end
end
