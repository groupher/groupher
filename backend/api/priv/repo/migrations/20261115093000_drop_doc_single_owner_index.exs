defmodule GroupherServer.Repo.Migrations.DropDocSingleOwnerIndex do
  use Ecto.Migration

  def up do
    execute("DROP INDEX IF EXISTS cms.article_bindings_doc_single_owner_index")
  end

  def down do
    raise "Doc multi-binding has no single-owner rollback"
  end
end
