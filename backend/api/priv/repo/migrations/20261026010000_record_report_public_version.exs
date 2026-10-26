defmodule GroupherServer.Repo.Migrations.RecordReportPublicVersion do
  use Ecto.Migration

  def change do
    alter table(:user_reports, prefix: "alert_wall") do
      add(:observed_version, :integer)
    end

    create(
      constraint(:user_reports, :user_reports_cms_observed_version,
        prefix: "alert_wall",
        check: "owner <> 'cms' OR (observed_version IS NOT NULL AND observed_version > 0)"
      )
    )
  end
end
