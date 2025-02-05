defmodule GroupherServer.Repo.Migrations.AlterCatStateToInt do
  use Ecto.Migration

  def change do
    alter table(:cms_posts) do
      remove :cat
      remove :state
      add :cat, :integer
      add :state, :integer
    end
  end
end
