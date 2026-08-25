defmodule GroupherServer.Repo.Migrations.AddPolymorphicArticleConstraintsAndIndexes do
  use Ecto.Migration

  @prefix "cms"
  @article_ref_columns ~w(post_id blog_id changelog_id doc_id)a

  def up do
    dedupe_article_collects(:blog_id)
    dedupe_article_collects(:changelog_id)
    dedupe_article_collects(:doc_id)

    dedupe_pinned_comments(:post_id)
    dedupe_pinned_comments(:blog_id)
    dedupe_pinned_comments(:changelog_id)
    dedupe_pinned_comments(:doc_id)

    create_if_not_exists(
      index(:comments, [:thread], prefix: @prefix, name: :comments_thread_index)
    )

    create_if_not_exists(
      index(:comments, [:reply_to_id, :inserted_at],
        prefix: @prefix,
        name: :comments_reply_to_id_inserted_at_index
      )
    )

    create_if_not_exists(
      index(:comments, [:post_id, :inserted_at],
        prefix: @prefix,
        name: :comments_post_id_inserted_at_index
      )
    )

    create_if_not_exists(
      index(:comments, [:blog_id, :inserted_at],
        prefix: @prefix,
        name: :comments_blog_id_inserted_at_index
      )
    )

    create_if_not_exists(
      index(:comments, [:changelog_id, :inserted_at],
        prefix: @prefix,
        name: :comments_changelog_id_inserted_at_index
      )
    )

    create_if_not_exists(
      index(:comments, [:doc_id, :inserted_at],
        prefix: @prefix,
        name: :comments_doc_id_inserted_at_index
      )
    )

    create_if_not_exists(
      index(:article_collects, [:thread], prefix: @prefix, name: :article_collects_thread_index)
    )

    create_if_not_exists(
      unique_index(:article_collects, [:user_id, :blog_id],
        prefix: @prefix,
        name: :article_collects_user_id_blog_id_index
      )
    )

    create_if_not_exists(
      unique_index(:article_collects, [:user_id, :changelog_id],
        prefix: @prefix,
        name: :article_collects_user_id_changelog_id_index
      )
    )

    create_if_not_exists(
      unique_index(:article_collects, [:user_id, :doc_id],
        prefix: @prefix,
        name: :article_collects_user_id_doc_id_index
      )
    )

    create_if_not_exists(
      unique_index(:pinned_comments, [:post_id, :comment_id],
        prefix: @prefix,
        name: :pinned_comments_post_id_comment_id_index
      )
    )

    create_if_not_exists(
      unique_index(:pinned_comments, [:blog_id, :comment_id],
        prefix: @prefix,
        name: :pinned_comments_blog_id_comment_id_index
      )
    )

    create_if_not_exists(
      unique_index(:pinned_comments, [:changelog_id, :comment_id],
        prefix: @prefix,
        name: :pinned_comments_changelog_id_comment_id_index
      )
    )

    create_if_not_exists(
      unique_index(:pinned_comments, [:doc_id, :comment_id],
        prefix: @prefix,
        name: :pinned_comments_doc_id_comment_id_index
      )
    )

    add_check_constraint_if_missing(
      :comments,
      :comments_exactly_one_article_ref_check,
      exactly_one_article_ref_sql()
    )

    add_check_constraint_if_missing(
      :comments,
      :comments_thread_matches_article_ref_check,
      thread_matches_article_ref_sql()
    )

    add_check_constraint_if_missing(
      :article_upvotes,
      :article_upvotes_exactly_one_article_ref_check,
      exactly_one_article_ref_sql()
    )

    add_check_constraint_if_missing(
      :article_upvotes,
      :article_upvotes_thread_matches_article_ref_check,
      thread_matches_article_ref_sql()
    )

    add_check_constraint_if_missing(
      :article_collects,
      :article_collects_exactly_one_article_ref_check,
      exactly_one_article_ref_sql()
    )

    add_check_constraint_if_missing(
      :article_collects,
      :article_collects_thread_matches_article_ref_check,
      thread_matches_article_ref_sql()
    )

    add_check_constraint_if_missing(
      :pinned_comments,
      :pinned_comments_exactly_one_article_ref_check,
      exactly_one_article_ref_sql()
    )

    add_check_constraint_if_missing(
      :articles_users_emotions,
      :articles_users_emotions_exactly_one_article_ref_check,
      exactly_one_article_ref_sql()
    )

    add_check_constraint_if_missing(
      :abuse_reports,
      :abuse_reports_at_most_one_article_ref_check,
      at_most_one_article_ref_sql()
    )

    add_check_constraint_if_missing(
      :cited_artiments,
      :cited_artiments_at_most_one_article_ref_check,
      at_most_one_article_ref_sql()
    )
  end

  def down do
    drop_if_exists(index(:comments, [:thread], prefix: @prefix, name: :comments_thread_index))

    drop_if_exists(
      index(:comments, [:reply_to_id, :inserted_at],
        prefix: @prefix,
        name: :comments_reply_to_id_inserted_at_index
      )
    )

    drop_if_exists(
      index(:comments, [:post_id, :inserted_at],
        prefix: @prefix,
        name: :comments_post_id_inserted_at_index
      )
    )

    drop_if_exists(
      index(:comments, [:blog_id, :inserted_at],
        prefix: @prefix,
        name: :comments_blog_id_inserted_at_index
      )
    )

    drop_if_exists(
      index(:comments, [:changelog_id, :inserted_at],
        prefix: @prefix,
        name: :comments_changelog_id_inserted_at_index
      )
    )

    drop_if_exists(
      index(:comments, [:doc_id, :inserted_at],
        prefix: @prefix,
        name: :comments_doc_id_inserted_at_index
      )
    )

    drop_if_exists(
      index(:article_collects, [:thread], prefix: @prefix, name: :article_collects_thread_index)
    )

    drop_if_exists(
      unique_index(:article_collects, [:user_id, :blog_id],
        prefix: @prefix,
        name: :article_collects_user_id_blog_id_index
      )
    )

    drop_if_exists(
      unique_index(:article_collects, [:user_id, :changelog_id],
        prefix: @prefix,
        name: :article_collects_user_id_changelog_id_index
      )
    )

    drop_if_exists(
      unique_index(:article_collects, [:user_id, :doc_id],
        prefix: @prefix,
        name: :article_collects_user_id_doc_id_index
      )
    )

    drop_if_exists(
      unique_index(:pinned_comments, [:post_id, :comment_id],
        prefix: @prefix,
        name: :pinned_comments_post_id_comment_id_index
      )
    )

    drop_if_exists(
      unique_index(:pinned_comments, [:blog_id, :comment_id],
        prefix: @prefix,
        name: :pinned_comments_blog_id_comment_id_index
      )
    )

    drop_if_exists(
      unique_index(:pinned_comments, [:changelog_id, :comment_id],
        prefix: @prefix,
        name: :pinned_comments_changelog_id_comment_id_index
      )
    )

    drop_if_exists(
      unique_index(:pinned_comments, [:doc_id, :comment_id],
        prefix: @prefix,
        name: :pinned_comments_doc_id_comment_id_index
      )
    )

    drop_check_constraint_if_exists(:comments, :comments_exactly_one_article_ref_check)
    drop_check_constraint_if_exists(:comments, :comments_thread_matches_article_ref_check)

    drop_check_constraint_if_exists(
      :article_upvotes,
      :article_upvotes_exactly_one_article_ref_check
    )

    drop_check_constraint_if_exists(
      :article_upvotes,
      :article_upvotes_thread_matches_article_ref_check
    )

    drop_check_constraint_if_exists(
      :article_collects,
      :article_collects_exactly_one_article_ref_check
    )

    drop_check_constraint_if_exists(
      :article_collects,
      :article_collects_thread_matches_article_ref_check
    )

    drop_check_constraint_if_exists(
      :pinned_comments,
      :pinned_comments_exactly_one_article_ref_check
    )

    drop_check_constraint_if_exists(
      :articles_users_emotions,
      :articles_users_emotions_exactly_one_article_ref_check
    )

    drop_check_constraint_if_exists(:abuse_reports, :abuse_reports_at_most_one_article_ref_check)

    drop_check_constraint_if_exists(
      :cited_artiments,
      :cited_artiments_at_most_one_article_ref_check
    )
  end

  defp exactly_one_article_ref_sql do
    "num_nonnulls(#{article_ref_args()}) = 1"
  end

  defp at_most_one_article_ref_sql do
    "num_nonnulls(#{article_ref_args()}) <= 1"
  end

  defp thread_matches_article_ref_sql do
    """
    (
      (thread = 'POST' AND post_id IS NOT NULL AND blog_id IS NULL AND changelog_id IS NULL AND doc_id IS NULL) OR
      (thread = 'BLOG' AND blog_id IS NOT NULL AND post_id IS NULL AND changelog_id IS NULL AND doc_id IS NULL) OR
      (thread = 'CHANGELOG' AND changelog_id IS NOT NULL AND post_id IS NULL AND blog_id IS NULL AND doc_id IS NULL) OR
      (thread = 'DOC' AND doc_id IS NOT NULL AND post_id IS NULL AND blog_id IS NULL AND changelog_id IS NULL)
    )
    """
    |> String.trim()
  end

  defp article_ref_args do
    Enum.map_join(@article_ref_columns, ", ", &Atom.to_string/1)
  end

  defp add_check_constraint_if_missing(table, name, check_sql) do
    execute("""
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.conname = '#{name}'
          AND t.relname = '#{table}'
          AND n.nspname = '#{@prefix}'
      ) THEN
        ALTER TABLE #{@prefix}.#{table}
        ADD CONSTRAINT #{name}
        CHECK (#{check_sql}) NOT VALID;
      END IF;
    END
    $$;
    """)
  end

  defp drop_check_constraint_if_exists(table, name) do
    execute("""
    ALTER TABLE IF EXISTS #{@prefix}.#{table}
    DROP CONSTRAINT IF EXISTS #{name}
    """)
  end

  defp dedupe_article_collects(column) do
    execute("""
    DELETE FROM #{@prefix}.article_collects
    WHERE id IN (
      SELECT id
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id, #{column}
                 ORDER BY updated_at DESC NULLS LAST, inserted_at DESC NULLS LAST, id DESC
               ) AS rn
        FROM #{@prefix}.article_collects
        WHERE #{column} IS NOT NULL
      ) duplicates
      WHERE duplicates.rn > 1
    )
    """)
  end

  defp dedupe_pinned_comments(column) do
    execute("""
    DELETE FROM #{@prefix}.pinned_comments
    WHERE id IN (
      SELECT id
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY comment_id, #{column}
                 ORDER BY updated_at DESC NULLS LAST, inserted_at DESC NULLS LAST, id DESC
               ) AS rn
        FROM #{@prefix}.pinned_comments
        WHERE #{column} IS NOT NULL
      ) duplicates
      WHERE duplicates.rn > 1
    )
    """)
  end
end
