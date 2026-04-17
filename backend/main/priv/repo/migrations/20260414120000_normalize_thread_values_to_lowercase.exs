defmodule GroupherServer.Repo.Migrations.NormalizeThreadValuesToLowercase do
  use Ecto.Migration

  @cms_prefix "cms"
  @messaging_prefix "messaging"
  @thread_tables [
    {@cms_prefix, :article_collects},
    {@cms_prefix, :article_documents},
    {@cms_prefix, :article_upvotes},
    {@cms_prefix, :comments},
    {@cms_prefix, :community_tags},
    {@cms_prefix, :pinned_articles},
    {@messaging_prefix, :mentions},
    {@messaging_prefix, :notifications}
  ]
  @article_tables ~w(posts blogs changelogs docs)a
  @thread_match_tables ~w(comments article_upvotes article_collects)a
  @article_ref_columns ~w(post_id blog_id changelog_id doc_id)

  def up do
    Enum.each(@thread_match_tables, &drop_thread_match_constraint/1)
    Enum.each(@thread_match_tables, &delete_invalid_thread_ref_rows/1)

    Enum.each(@thread_tables, &normalize_thread_column/1)
    Enum.each(@article_tables, &normalize_article_meta_thread/1)

    Enum.each(@thread_match_tables, &recreate_thread_match_constraint/1)
  end

  def down do
    raise "irreversible migration"
  end

  defp normalize_thread_column({prefix, table}) do
    execute("""
    UPDATE #{prefix}.#{table}
    SET thread = LOWER(thread)
    WHERE thread IS NOT NULL
    """)
  end

  defp normalize_article_meta_thread(table) do
    execute("""
    UPDATE #{@cms_prefix}.#{table}
    SET meta = jsonb_set(meta, '{thread}', to_jsonb(LOWER(meta->>'thread')))
    WHERE meta IS NOT NULL AND meta ? 'thread' AND meta->>'thread' IS NOT NULL
    """)
  end

  defp recreate_thread_match_constraint(table) do
    create(
      constraint(table, :"#{table}_thread_matches_article_ref_check",
        check: thread_matches_article_ref_sql(),
        prefix: @cms_prefix
      )
    )
  end

  defp drop_thread_match_constraint(table) do
    drop_check_constraint_if_exists(table, :"#{table}_thread_matches_article_ref_check")
  end

  defp drop_check_constraint_if_exists(table, name) do
    execute("""
    ALTER TABLE #{@cms_prefix}.#{table}
    DROP CONSTRAINT IF EXISTS #{name}
    """)
  end

  defp delete_invalid_thread_ref_rows(table) do
    execute("""
    DELETE FROM #{@cms_prefix}.#{table}
    WHERE thread IS NULL
       OR num_nonnulls(#{Enum.join(@article_ref_columns, ", ")}) != 1
    """)
  end

  defp thread_matches_article_ref_sql do
    """
    (
      (thread = 'post' AND post_id IS NOT NULL AND blog_id IS NULL AND changelog_id IS NULL AND doc_id IS NULL) OR
      (thread = 'blog' AND blog_id IS NOT NULL AND post_id IS NULL AND changelog_id IS NULL AND doc_id IS NULL) OR
      (thread = 'changelog' AND changelog_id IS NOT NULL AND post_id IS NULL AND blog_id IS NULL AND doc_id IS NULL) OR
      (thread = 'doc' AND doc_id IS NOT NULL AND post_id IS NULL AND blog_id IS NULL AND changelog_id IS NULL)
    )
    """
    |> String.trim()
  end
end
