defmodule GroupherServer.Repo.Migrations.AddBlogDocument do
  use Ecto.Migration

  def change do
    create table(:blog_documents) do
      add(:blog_id, references(:cms_blogs, on_delete: :delete_all), null: false)
      add(:body, :text)
      add(:body_html, :text)
      add(:markdown, :text)
      add(:toc, :map)
    end
  end
end
