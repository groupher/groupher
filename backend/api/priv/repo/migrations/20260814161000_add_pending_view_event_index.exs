defmodule GroupherServer.Repo.Migrations.AddPendingViewEventIndex do
  use Ecto.Migration

  def up do
    create index(:view_events, [:target_type, :target_id, :user_id],
             prefix: "cms",
             name: :view_events_pending_viewer_lookup_index,
             where: "processed_at IS NULL"
           )
  end

  def down do
    drop index(:view_events, [:target_type, :target_id, :user_id],
           prefix: "cms",
           name: :view_events_pending_viewer_lookup_index
         )
  end
end
