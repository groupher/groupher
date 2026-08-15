defmodule GroupherServer.Repo.Migrations.CutOverLegacyInteractionCounts do
  use Ecto.Migration

  @article_targets [
    {:posts, :post_reaction_infos, :post_id},
    {:blogs, :blog_reaction_infos, :blog_id},
    {:changelogs, :changelog_reaction_infos, :changelog_id},
    {:docs, :doc_reaction_infos, :doc_id}
  ]

  def up do
    Enum.each(@article_targets, fn {table, _projection, _target_id} ->
      alter table(table, prefix: "cms") do
        remove(:upvotes_count)
        remove(:collects_count)
      end
    end)

    alter table(:comments, prefix: "cms") do
      remove(:upvotes_count)
    end
  end

  def down do
    Enum.each(@article_targets, fn {table, _projection, _target_id} ->
      alter table(table, prefix: "cms") do
        add(:upvotes_count, :integer, null: false, default: 0)
        add(:collects_count, :integer, null: false, default: 0)
      end
    end)

    alter table(:comments, prefix: "cms") do
      add(:upvotes_count, :integer, null: false, default: 0)
    end

    Enum.each(@article_targets, fn {table, projection, target_id} ->
      execute("""
      UPDATE cms.#{table} target
      SET upvotes_count = projection.upvotes_count,
          collects_count = projection.collects_count
      FROM cms.#{projection} projection
      WHERE projection.#{target_id} = target.id
      """)
    end)

    execute("""
    UPDATE cms.comments target
    SET upvotes_count = projection.upvotes_count
    FROM cms.comment_reaction_infos projection
    WHERE projection.comment_id = target.id
    """)
  end
end
