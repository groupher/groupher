defmodule GroupherServer.Repo.Migrations.DropLegacyArticleDocumentStorage do
  use Ecto.Migration

  @moduledoc "Drops mutable physical Article body and asset-ref authority."

  def up do
    drop(table(:article_document_asset_refs, prefix: "cms"))
    drop(table(:article_documents, prefix: "cms"))
  end

  def down do
    execute("SELECT 1")
  end
end
