defmodule GroupherServer.Repo.Migrations.AddContentImportItemFailures do
  use Ecto.Migration

  @prefix "cms"

  def up do
    alter table(:content_import_job_items, prefix: @prefix) do
      add(:error_code, :string)
      add(:error_message, :text)
      add(:error_stage, :string)
    end

    drop(
      constraint(:content_import_job_items, :content_import_job_items_status_check,
        prefix: @prefix
      )
    )

    create(
      constraint(:content_import_job_items, :content_import_job_items_status_check,
        prefix: @prefix,
        check: "content_status IN ('pending', 'ready', 'skipped', 'failed')"
      )
    )
  end

  def down do
    drop(
      constraint(:content_import_job_items, :content_import_job_items_status_check,
        prefix: @prefix
      )
    )

    alter table(:content_import_job_items, prefix: @prefix) do
      remove(:error_code)
      remove(:error_message)
      remove(:error_stage)
    end

    create(
      constraint(:content_import_job_items, :content_import_job_items_status_check,
        prefix: @prefix,
        check: "content_status IN ('pending', 'ready', 'skipped')"
      )
    )
  end
end
