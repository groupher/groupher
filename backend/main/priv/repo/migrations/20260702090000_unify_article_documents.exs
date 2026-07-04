defmodule GroupherServer.Repo.Migrations.UnifyArticleDocuments do
  use Ecto.Migration

  @prefix "cms"

  @sources [
    {"post", "posts", "post_documents", "post_id"},
    {"blog", "blogs", "blog_documents", "blog_id"},
    {"changelog", "changelogs", "changelog_documents", "changelog_id"},
    {"doc", "docs", "doc_documents", "doc_id"}
  ]

  def up do
    Enum.each(@sources, &backfill_source/1)
    delete_unscoped_article_documents()
    dedupe_article_documents()

    alter table(:article_documents, prefix: @prefix) do
      modify(:article_id, :id, null: false)
    end

    create_if_not_exists(
      unique_index(:article_documents, [:thread, :article_id],
        prefix: @prefix,
        name: :article_documents_thread_article_id_index
      )
    )
  end

  def down do
    drop_if_exists(
      unique_index(:article_documents, [:thread, :article_id],
        prefix: @prefix,
        name: :article_documents_thread_article_id_index
      )
    )

    alter table(:article_documents, prefix: @prefix) do
      modify(:article_id, :id, null: true)
    end
  end

  defp backfill_source({thread, article_table, document_table, article_fk}) do
    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.#{document_table}') IS NOT NULL
         AND to_regclass('#{@prefix}.#{article_table}') IS NOT NULL
         AND to_regclass('#{@prefix}.article_documents') IS NOT NULL
      THEN
        INSERT INTO #{@prefix}.article_documents (
          thread,
          article_id,
          title,
          json,
          markdown,
          markdown_toc,
          html,
          xml,
          rss,
          plain_text,
          digest,
          content_hash,
          schema_version,
          inserted_at,
          updated_at
        )
        SELECT
          '#{thread}',
          document.#{article_fk},
          article.title,
          document.json,
          document.markdown,
          document.markdown_toc,
          document.html,
          document.xml,
          document.rss,
          document.plain_text,
          document.digest,
          document.content_hash,
          COALESCE(document.schema_version, 1),
          NOW(),
          NOW()
        FROM #{@prefix}.#{document_table} AS document
        JOIN #{@prefix}.#{article_table} AS article
          ON article.id = document.#{article_fk}
        WHERE NOT EXISTS (
          SELECT 1
          FROM #{@prefix}.article_documents AS article_document
          WHERE article_document.thread = '#{thread}'
            AND article_document.article_id = document.#{article_fk}
        );
      END IF;
    END $$;
    """)
  end

  defp dedupe_article_documents do
    execute("""
    DELETE FROM #{@prefix}.article_documents AS article_document
    USING (
      SELECT id
      FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY thread, article_id
            ORDER BY updated_at DESC NULLS LAST, inserted_at DESC NULLS LAST, id DESC
          ) AS row_number
        FROM #{@prefix}.article_documents
      ) AS ranked
      WHERE ranked.row_number > 1
    ) AS duplicate
    WHERE article_document.id = duplicate.id;
    """)
  end

  defp delete_unscoped_article_documents do
    execute("""
    DELETE FROM #{@prefix}.article_documents
    WHERE article_id IS NULL;
    """)
  end
end
