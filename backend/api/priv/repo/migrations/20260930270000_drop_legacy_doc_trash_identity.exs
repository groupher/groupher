defmodule GroupherServer.Repo.Migrations.DropLegacyDocTrashIdentity do
  use Ecto.Migration

  @moduledoc "Makes stable Article UUID the only Doc Trash article identity."

  def up do
    alter table(:trashed_doc_articles, prefix: "cms") do
      modify(:article_id, :uuid, null: false)
      remove(:article_hash_id)
    end
  end

  def down do
    alter table(:trashed_doc_articles, prefix: "cms") do
      add(:article_hash_id, :uuid)
      modify(:article_id, :uuid, null: true)
    end
  end
end
