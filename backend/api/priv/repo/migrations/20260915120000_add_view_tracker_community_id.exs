defmodule GroupherServer.Repo.Migrations.AddViewTrackerCommunityId do
  use Ecto.Migration

  def up do
    alter table(:view_events, prefix: "cms") do
      add(:community_id, references(:communities, prefix: "cms", on_delete: :nilify_all))
    end

    create(index(:view_events, [:community_id, :occurred_at], prefix: "cms"))
  end

  def down do
    drop(index(:view_events, [:community_id, :occurred_at], prefix: "cms"))

    alter table(:view_events, prefix: "cms") do
      remove(:community_id)
    end
  end
end
