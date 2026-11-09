defmodule GroupherServer.Repo.Migrations.NilifyReportOriginOnCommunityDelete do
  @moduledoc "Preserves report history after its reporting Community is removed."

  use Ecto.Migration

  def up do
    execute("ALTER TABLE alert_wall.user_reports DROP CONSTRAINT reports_community_id_fkey")

    execute("""
    ALTER TABLE alert_wall.user_reports
    ADD CONSTRAINT reports_community_id_fkey
    FOREIGN KEY (community_id) REFERENCES cms.communities(id) ON DELETE SET NULL
    """)
  end

  def down do
    execute("ALTER TABLE alert_wall.user_reports DROP CONSTRAINT reports_community_id_fkey")

    execute("""
    ALTER TABLE alert_wall.user_reports
    ADD CONSTRAINT reports_community_id_fkey
    FOREIGN KEY (community_id) REFERENCES cms.communities(id) ON DELETE RESTRICT
    """)
  end
end
