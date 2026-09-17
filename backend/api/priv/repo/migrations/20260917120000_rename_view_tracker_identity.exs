defmodule GroupherServer.Repo.Migrations.RenameViewTrackerIdentity do
  use Ecto.Migration

  @tables ~w(view_events article_viewer_states article_view_dedupe_states)a

  def up do
    Enum.each(@tables, fn table_name ->
      rename(table(table_name, prefix: "cms"), :target_type, to: :thread)
      rename(table(table_name, prefix: "cms"), :target_id, to: :article_id)
    end)
  end

  def down do
    Enum.each(@tables, fn table_name ->
      rename(table(table_name, prefix: "cms"), :thread, to: :target_type)
      rename(table(table_name, prefix: "cms"), :article_id, to: :target_id)
    end)
  end
end
