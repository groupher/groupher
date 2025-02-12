defmodule GroupherServer.Repo.Migrations.CreateChangelogDocument do
  use Ecto.Migration

  def change do
    create table(:changelog_documents) do
      add(:changelog_id, references(:cms_changelogs, on_delete: :delete_all), null: false)
      add(:body, :text)
      add(:body_html, :text)
      add(:markdown, :text)
      add(:toc, :map)
    end
  end
end
