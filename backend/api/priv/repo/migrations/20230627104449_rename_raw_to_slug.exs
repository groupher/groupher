defmodule GroupherServer.Repo.Migrations.RenameRawToSlug do
  use Ecto.Migration

  def change do
    rename(table(:article_tags), :raw, to: :slug)
    rename(table(:categories), :raw, to: :slug)
    rename(table(:threads), :raw, to: :slug)
    rename(table(:communities), :raw, to: :slug)
  end
end
