defmodule GroupherServer.Repo.Migrations.AddInnerIdToComments do
  use Ecto.Migration

  @prefix "cms"
  @article_refs [
    {:post_id, :posts},
    {:blog_id, :blogs},
    {:changelog_id, :changelogs},
    {:doc_id, :docs}
  ]

  def up do
    alter table(:comments, prefix: @prefix) do
      add(:inner_id, :id)
    end

    backfill_comment_inner_ids()
    backfill_embedded_reply_inner_ids()

    alter table(:comments, prefix: @prefix) do
      modify(:inner_id, :id, null: false)
    end

    Enum.each(@article_refs, fn {ref_column, _table} ->
      create_if_not_exists(
        unique_index(:comments, [ref_column, :inner_id],
          prefix: @prefix,
          name: :"comments_#{ref_column}_inner_id_index",
          where: "#{ref_column} IS NOT NULL"
        )
      )
    end)

    Enum.each(@article_refs, fn {ref_column, table} ->
      backfill_article_next_comment_inner_id(table, ref_column)
    end)
  end

  def down do
    Enum.each(@article_refs, fn {ref_column, _table} ->
      drop_if_exists(
        unique_index(:comments, [ref_column, :inner_id],
          prefix: @prefix,
          name: :"comments_#{ref_column}_inner_id_index"
        )
      )
    end)

    alter table(:comments, prefix: @prefix) do
      remove(:inner_id)
    end

    remove_embedded_reply_inner_ids()

    Enum.each(@article_refs, fn {_ref_column, table} ->
      remove_article_next_comment_inner_id(table)
    end)
  end

  defp backfill_comment_inner_ids do
    execute("""
    WITH scoped AS (
      SELECT
        id,
        floor,
        CASE
          WHEN post_id IS NOT NULL THEN 'post'
          WHEN blog_id IS NOT NULL THEN 'blog'
          WHEN changelog_id IS NOT NULL THEN 'changelog'
          WHEN doc_id IS NOT NULL THEN 'doc'
        END AS ref_type,
        COALESCE(post_id, blog_id, changelog_id, doc_id) AS article_id
      FROM #{@prefix}.comments
    ),
    ranked AS (
      SELECT
        id,
        floor,
        ref_type,
        article_id,
        ROW_NUMBER() OVER (
          PARTITION BY ref_type, article_id, floor
          ORDER BY id
        ) AS floor_rank,
        COALESCE(MAX(floor) OVER (PARTITION BY ref_type, article_id), 0) AS max_floor
      FROM scoped
      WHERE ref_type IS NOT NULL AND article_id IS NOT NULL
    ),
    classified AS (
      SELECT
        id,
        floor,
        ref_type,
        article_id,
        max_floor,
        floor IS NULL OR floor_rank > 1 AS needs_new_inner_id
      FROM ranked
    ),
    assigned AS (
      SELECT
        id,
        CASE
          WHEN needs_new_inner_id THEN
            max_floor + ROW_NUMBER() OVER (
              PARTITION BY ref_type, article_id, needs_new_inner_id
              ORDER BY COALESCE(floor, 0), id
            )
          ELSE floor
        END AS inner_id
      FROM classified
    )
    UPDATE #{@prefix}.comments AS comments
    SET inner_id = assigned.inner_id
    FROM assigned
    WHERE comments.id = assigned.id;
    """)

    execute("""
    UPDATE #{@prefix}.comments
    SET inner_id = id
    WHERE inner_id IS NULL;
    """)
  end

  defp backfill_embedded_reply_inner_ids do
    execute("""
    WITH expanded_replies AS (
      SELECT
        parent.id AS parent_id,
        reply.elem,
        reply.ord,
        child.inner_id
      FROM #{@prefix}.comments AS parent
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(parent.replies) = 'array' THEN parent.replies
          ELSE '[]'::jsonb
        END
      )
        WITH ORDINALITY AS reply(elem, ord)
      LEFT JOIN #{@prefix}.comments AS child
        ON child.id = CASE
          WHEN reply.elem ? 'id' AND reply.elem->>'id' ~ '^[0-9]+$' THEN (reply.elem->>'id')::bigint
        END
    ),
    rebuilt_replies AS (
      SELECT
        parent_id,
        jsonb_agg(
          CASE
            WHEN inner_id IS NULL THEN elem
            ELSE jsonb_set(elem, '{inner_id}', to_jsonb(inner_id), true)
          END
          ORDER BY ord
        ) AS replies
      FROM expanded_replies
      GROUP BY parent_id
    )
    UPDATE #{@prefix}.comments AS comments
    SET replies = rebuilt_replies.replies
    FROM rebuilt_replies
    WHERE comments.id = rebuilt_replies.parent_id;
    """)
  end

  defp backfill_article_next_comment_inner_id(table, ref_column) do
    execute("""
    UPDATE #{@prefix}.#{table} AS article
    SET meta = jsonb_set(
      COALESCE(article.meta, '{}'::jsonb),
      '{next_comment_inner_id}',
      to_jsonb(COALESCE(comment_stats.max_inner_id, 0)),
      true
    )
    FROM (
      SELECT #{ref_column} AS article_id, MAX(inner_id) AS max_inner_id
      FROM #{@prefix}.comments
      WHERE #{ref_column} IS NOT NULL
      GROUP BY #{ref_column}
    ) AS comment_stats
    WHERE article.id = comment_stats.article_id;
    """)

    execute("""
    UPDATE #{@prefix}.#{table} AS article
    SET meta = jsonb_set(
      COALESCE(article.meta, '{}'::jsonb),
      '{next_comment_inner_id}',
      '0'::jsonb,
      true
    )
    WHERE NOT (COALESCE(article.meta, '{}'::jsonb) ? 'next_comment_inner_id');
    """)
  end

  defp remove_embedded_reply_inner_ids do
    execute("""
    WITH expanded_replies AS (
      SELECT
        parent.id AS parent_id,
        reply.elem,
        reply.ord
      FROM #{@prefix}.comments AS parent
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(parent.replies) = 'array' THEN parent.replies
          ELSE '[]'::jsonb
        END
      )
        WITH ORDINALITY AS reply(elem, ord)
    ),
    rebuilt_replies AS (
      SELECT
        parent_id,
        jsonb_agg(elem - 'inner_id' ORDER BY ord) AS replies
      FROM expanded_replies
      GROUP BY parent_id
    )
    UPDATE #{@prefix}.comments AS comments
    SET replies = rebuilt_replies.replies
    FROM rebuilt_replies
    WHERE comments.id = rebuilt_replies.parent_id;
    """)
  end

  defp remove_article_next_comment_inner_id(table) do
    execute("""
    UPDATE #{@prefix}.#{table}
    SET meta = meta - 'next_comment_inner_id'
    WHERE meta ? 'next_comment_inner_id';
    """)
  end
end
