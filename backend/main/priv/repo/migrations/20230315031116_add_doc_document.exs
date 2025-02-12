defmodule GroupherServer.Repo.Migrations.AddDocDocument do
  use Ecto.Migration

  def change do
    create table(:doc_documents) do
      add(:doc_id, references(:cms_docs, on_delete: :delete_all), null: false)
      add(:body, :text)
      add(:body_html, :text)
      add(:markdown, :text)
      add(:toc, :map)
    end
  end
end
