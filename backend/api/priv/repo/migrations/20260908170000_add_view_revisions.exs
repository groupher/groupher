defmodule GroupherServer.Repo.Migrations.AddViewRevisions do
  use Ecto.Migration

  @article_targets ~w(posts blogs changelogs docs)a

  def change do
    Enum.each(@article_targets, fn table_name ->
      alter table(table_name, prefix: "cms") do
        add(:views_revision, :bigint, null: false, default: 0)
      end
    end)
  end
end
