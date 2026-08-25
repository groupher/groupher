defmodule GroupherServer.Repo.Migrations.AddSubtitleToDocDrafts do
  use Ecto.Migration

  @prefix "cms"

  def change do
    alter table(:article_drafts, prefix: @prefix) do
      add(:subtitle, :string)
    end

    alter table(:docs, prefix: @prefix) do
      add(:subtitle, :string)
    end

    alter table(:article_snapshots, prefix: @prefix) do
      add(:subtitle, :string)
    end
  end
end
