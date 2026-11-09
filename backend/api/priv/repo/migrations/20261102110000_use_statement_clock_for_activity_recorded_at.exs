defmodule GroupherServer.Repo.Migrations.UseStatementClockForActivityRecordedAt do
  use Ecto.Migration

  @tables ~w(post_logs blog_logs changelog_logs doc_logs community_logs doc_tree_logs press_logs ticket_logs)

  def up do
    Enum.each(@tables, fn table ->
      execute(
        "ALTER TABLE activity.#{table} ALTER COLUMN recorded_at SET DEFAULT clock_timestamp()"
      )
    end)
  end

  def down do
    Enum.each(@tables, fn table ->
      execute("ALTER TABLE activity.#{table} ALTER COLUMN recorded_at SET DEFAULT now()")
    end)
  end
end
