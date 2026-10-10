defmodule GroupherServer.Repo.Migrations.AddAbuseReportCommunityContext do
  use Ecto.Migration

  @prefix "cms"

  def change do
    alter table(:abuse_reports, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :nilify_all))
    end

    create(index(:abuse_reports, [:community_id], prefix: @prefix))
  end
end
