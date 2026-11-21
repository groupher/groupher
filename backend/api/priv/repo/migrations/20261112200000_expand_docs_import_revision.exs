defmodule GroupherServer.Repo.Migrations.ExpandDocsImportRevision do
  use Ecto.Migration

  def change do
    alter table(:content_import_jobs, prefix: "cms") do
      modify(:target_revision, :text, null: false, from: {:string, null: false})
    end
  end
end
