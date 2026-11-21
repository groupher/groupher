defmodule GroupherServer.Repo.Migrations.AllowOptionalDocDefaultCopy do
  use Ecto.Migration

  def up do
    execute("ALTER TABLE cms.doc_lifecycles ALTER COLUMN default_working_copy_id DROP NOT NULL")

    create(
      constraint(:doc_lifecycles, :docs_unpublished_default_required,
        check: "default_working_copy_id IS NOT NULL OR first_published_at IS NOT NULL",
        prefix: "cms"
      )
    )
  end

  def down do
    raise "R5 does not recreate deleted default copies"
  end
end
