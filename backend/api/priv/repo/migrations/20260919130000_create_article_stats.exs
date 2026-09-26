defmodule GroupherServer.Repo.Migrations.CreateArticleStats do
  use Ecto.Migration

  @article_targets [
    {:post, :posts, :post_reaction_infos, :post_id},
    {:blog, :blogs, :blog_reaction_infos, :blog_id},
    {:changelog, :changelogs, :changelog_reaction_infos, :changelog_id},
    {:doc, :docs, :doc_reaction_infos, :doc_id}
  ]

  def up do
    create table(:article_stats, prefix: "cms") do
      add(:thread, :string, null: false)
      add(:article_id, :bigint, null: false)
      add(:views, :bigint, null: false, default: 0)
      add(:views_revision, :bigint, null: false, default: 0)
      add(:upvotes_count, :bigint, null: false, default: 0)
      add(:comments_count, :bigint, null: false, default: 0)
      add(:collects_count, :bigint, null: false, default: 0)
      add(:comments_participants_count, :bigint, null: false, default: 0)
      add(:interaction_revision, :bigint, null: false, default: 0)
      add(:comments_revision, :bigint, null: false, default: 0)
      add(:reaction_counts, :map, null: false, default: %{})
      add(:snapshot_at, :timestamptz, null: false)

      timestamps()
    end

    create(unique_index(:article_stats, [:thread, :article_id], prefix: "cms"))

    create(
      index(:article_stats, [:thread, desc: :views, desc: :article_id],
        prefix: "cms",
        name: :article_stats_thread_views_order_idx
      )
    )

    create(
      index(:article_stats, [:thread, desc: :upvotes_count, desc: :article_id],
        prefix: "cms",
        name: :article_stats_thread_upvotes_order_idx
      )
    )

    create(
      index(:article_stats, [:thread, desc: :comments_count, desc: :article_id],
        prefix: "cms",
        name: :article_stats_thread_comments_order_idx
      )
    )

    create(
      index(:article_stats, [:thread, desc: :collects_count, desc: :article_id],
        prefix: "cms",
        name: :article_stats_thread_collects_order_idx
      )
    )

    Enum.each(@article_targets, &backfill/1)
  end

  def down do
    drop(table(:article_stats, prefix: "cms"))
  end

  defp backfill({thread, articles, reaction_infos, reaction_id}) do
    emotion_infos =
      String.replace_suffix(to_string(reaction_infos), "reaction_infos", "emotion_infos")

    execute("""
    INSERT INTO cms.article_stats (
      thread,
      article_id,
      views,
      views_revision,
      upvotes_count,
      comments_count,
      collects_count,
      comments_participants_count,
      interaction_revision,
      comments_revision,
      reaction_counts,
      snapshot_at,
      inserted_at,
      updated_at
    )
    SELECT
      '#{thread}',
      article.id,
      COALESCE(summary.views, 0),
      COALESCE(summary.revision, 0),
      COALESCE(reactions.upvotes_count, 0),
      COALESCE(article.comments_count, 0),
      COALESCE(reactions.collects_count, 0),
      COALESCE(article.comments_participants_count, 0),
      COALESCE(reactions.interaction_revision, 0),
      COALESCE(article.comments_revision, 0),
      COALESCE(emotions.reaction_counts, '[]'::jsonb),
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM cms.#{articles} article
    LEFT JOIN cms.article_view_summaries summary
      ON summary.thread = '#{thread}' AND summary.article_id = article.id
    LEFT JOIN cms.#{reaction_infos} reactions
      ON reactions.#{reaction_id} = article.id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object('type', emotion, 'count', users_count)
        ORDER BY users_count DESC, emotion ASC
      ) AS reaction_counts
      FROM cms.#{emotion_infos}
      WHERE #{reaction_id} = article.id AND users_count > 0
    ) emotions ON TRUE
    """)
  end
end
