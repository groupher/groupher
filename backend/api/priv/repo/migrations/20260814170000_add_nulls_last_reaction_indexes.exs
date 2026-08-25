defmodule GroupherServer.Repo.Migrations.AddNullsLastReactionIndexes do
  use Ecto.Migration

  @indexes [
    {"post_reaction_infos", "post_id", ["upvotes_count", "collects_count"]},
    {"blog_reaction_infos", "blog_id", ["upvotes_count", "collects_count"]},
    {"changelog_reaction_infos", "changelog_id", ["upvotes_count", "collects_count"]},
    {"doc_reaction_infos", "doc_id", ["upvotes_count", "collects_count"]},
    {"comment_reaction_infos", "comment_id", ["upvotes_count"]}
  ]

  def up do
    Enum.each(@indexes, fn {table, target_id, count_fields} ->
      Enum.each(count_fields, fn count_field ->
        old_name = "#{table}_#{count_field}_#{target_id}_index"
        new_name = "#{table}_#{count_field}_nl_idx"

        execute("DROP INDEX IF EXISTS cms.#{old_name}")

        execute(
          "CREATE INDEX #{new_name} ON cms.#{table} (#{count_field} DESC NULLS LAST, #{target_id} DESC NULLS LAST)"
        )
      end)
    end)
  end

  def down do
    Enum.each(@indexes, fn {table, target_id, count_fields} ->
      Enum.each(count_fields, fn count_field ->
        old_name = "#{table}_#{count_field}_#{target_id}_index"
        new_name = "#{table}_#{count_field}_nl_idx"

        execute("DROP INDEX IF EXISTS cms.#{new_name}")

        execute(
          "CREATE INDEX #{old_name} ON cms.#{table} (#{count_field}, #{target_id})"
        )
      end)
    end)
  end
end
