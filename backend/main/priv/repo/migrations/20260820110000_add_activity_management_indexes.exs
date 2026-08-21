defmodule GroupherServer.Repo.Migrations.AddActivityManagementIndexes do
  use Ecto.Migration

  @tables ~w(post_logs blog_logs changelog_logs doc_logs community_logs doc_tree_logs press_logs)

  def up do
    Enum.each(@tables, fn table ->
      execute("""
      CREATE INDEX #{index_name(table)}
      ON activity.#{table} (community_id, action, occurred_at DESC, id DESC)
      """)
    end)
  end

  def down do
    Enum.each(@tables, fn table ->
      execute("DROP INDEX activity.#{index_name(table)}")
    end)
  end

  defp index_name(table), do: "#{table}_community_action_occurred_id_index"
end
