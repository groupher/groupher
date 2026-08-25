defmodule GroupherServer.Repo.Migrations.AddDocContent do
  use Ecto.Migration

  def change do
    create table(:doc_contents) do
      add(:doc_id, references(:cms_docs, on_delete: :delete_all), null: false)
      add(:body, :text)
      add(:body_html, :text)
      add(:markdown, :text)
      add(:toc, :map)
    end
  end
end
