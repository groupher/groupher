defmodule GroupherServer.Repo.Migrations.BackfillReactionProjectionCounts do
  use Ecto.Migration

  @article_threads [:post, :blog, :changelog, :doc]

  def up do
    Enum.each(@article_threads, &backfill_article/1)
    backfill_comment()
  end

  # Projection rows and counts are rebuildable, so rollback deliberately keeps
  # the backfilled state and relies on the normal audit/rebuild path if needed.
  def down, do: :ok

  defp backfill_article(thread) do
    target = "#{thread}_id"
    reaction_table = "#{thread}_reaction_infos"
    emotion_table = "#{thread}_emotion_infos"
    upvote_filter = "thread = '#{thread}' AND #{target} IS NOT NULL"

    backfill_fixed(reaction_table, target, "article_upvotes", target, upvote_filter, "upvoted_user_ids", "upvotes_count")
    backfill_fixed(reaction_table, target, "article_collects", target, upvote_filter, "collected_user_ids", "collects_count")

    backfill_emotion(emotion_table, target, "articles_users_emotions", target, "#{target} IS NOT NULL")
  end

  defp backfill_comment do
    backfill_fixed(
      "comment_reaction_infos",
      "comment_id",
      "comments_upvotes",
      "comment_id",
      "comment_id IS NOT NULL",
      "upvoted_user_ids",
      "upvotes_count"
    )

    backfill_emotion(
      "comment_emotion_infos",
      "comment_id",
      "comments_users_emotions",
      "comment_id",
      "comment_id IS NOT NULL"
    )
  end

  defp backfill_fixed(info_table, info_target, fact_table, fact_target, filter, bitmap, count) do
    execute("""
    INSERT INTO cms.#{info_table} (#{info_target}, inserted_at, updated_at)
    SELECT DISTINCT #{fact_target}, now(), now()
    FROM cms.#{fact_table}
    WHERE #{filter}
    ON CONFLICT (#{info_target}) DO NOTHING
    """)

    execute("""
    WITH grouped AS (
      SELECT #{fact_target} AS target_id,
             rb64_build(array_agg(user_id)::bigint[]) AS users
      FROM cms.#{fact_table}
      WHERE #{filter}
      GROUP BY #{fact_target}
    )
    UPDATE cms.#{info_table} info
    SET #{bitmap} = grouped.users,
        #{count} = rb64_cardinality(grouped.users),
        updated_at = now()
    FROM grouped
    WHERE info.#{info_target} = grouped.target_id
    """)

    execute("""
    UPDATE cms.#{info_table} info
    SET #{bitmap} = '{}'::roaringbitmap64,
        #{count} = 0,
        updated_at = now()
    WHERE NOT EXISTS (
      SELECT 1
      FROM cms.#{fact_table} fact
      WHERE #{filter}
        AND fact.#{fact_target} = info.#{info_target}
    )
    """)
  end

  defp backfill_emotion(info_table, info_target, fact_table, fact_target, filter) do
    execute("""
    INSERT INTO cms.#{info_table} (#{info_target}, emotion, inserted_at, updated_at)
    SELECT DISTINCT #{fact_target}, emotion, now(), now()
    FROM cms.#{fact_table}
    WHERE #{filter}
    ON CONFLICT (#{info_target}, emotion) DO NOTHING
    """)

    execute("""
    WITH grouped AS (
      SELECT #{fact_target} AS target_id,
             emotion,
             rb64_build(array_agg(user_id)::bigint[]) AS users
      FROM cms.#{fact_table}
      WHERE #{filter}
      GROUP BY #{fact_target}, emotion
    )
    UPDATE cms.#{info_table} info
    SET user_ids = grouped.users,
        users_count = rb64_cardinality(grouped.users),
        updated_at = now()
    FROM grouped
    WHERE info.#{info_target} = grouped.target_id
      AND info.emotion = grouped.emotion
    """)

    execute("""
    UPDATE cms.#{info_table} info
    SET user_ids = '{}'::roaringbitmap64,
        users_count = 0,
        updated_at = now()
    WHERE NOT EXISTS (
      SELECT 1
      FROM cms.#{fact_table} fact
      WHERE #{filter}
        AND fact.#{fact_target} = info.#{info_target}
        AND fact.emotion = info.emotion
    )
    """)
  end
end
