defmodule GroupherServer.Repo.Migrations.AddArticleHashIdToComments do
  use Ecto.Migration

  @cms_prefix "cms"

  def up do
    alter table(:comments, prefix: @cms_prefix) do
      add(:article_hash_id, :uuid, null: true)
    end

    for {table, foreign_key} <- [
          {"posts", "post_id"},
          {"blogs", "blog_id"},
          {"changelogs", "changelog_id"},
          {"docs", "doc_id"}
        ] do
      execute("""
      UPDATE cms.comments AS comment
      SET article_hash_id = article.article_hash_id
      FROM cms.#{table} AS article
      WHERE comment.#{foreign_key} = article.id
      """)
    end

    execute("""
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM cms.comments WHERE article_hash_id IS NULL) THEN
        RAISE EXCEPTION 'cannot backfill cms.comments.article_hash_id';
      END IF;
    END
    $$
    """)

    alter table(:comments, prefix: @cms_prefix) do
      modify(:article_hash_id, :uuid, null: false)
    end

    create(index(:comments, [:community_id, :thread, :article_hash_id], prefix: @cms_prefix))

    execute("""
    CREATE FUNCTION cms.ensure_comment_article_hash_matches_article()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      expected_article_hash_id uuid;
    BEGIN
      CASE
        WHEN NEW.post_id IS NOT NULL THEN SELECT article_hash_id INTO expected_article_hash_id FROM cms.posts WHERE id = NEW.post_id;
        WHEN NEW.blog_id IS NOT NULL THEN SELECT article_hash_id INTO expected_article_hash_id FROM cms.blogs WHERE id = NEW.blog_id;
        WHEN NEW.changelog_id IS NOT NULL THEN SELECT article_hash_id INTO expected_article_hash_id FROM cms.changelogs WHERE id = NEW.changelog_id;
        WHEN NEW.doc_id IS NOT NULL THEN SELECT article_hash_id INTO expected_article_hash_id FROM cms.docs WHERE id = NEW.doc_id;
      END CASE;

      IF expected_article_hash_id IS NULL OR expected_article_hash_id <> NEW.article_hash_id THEN
        RAISE EXCEPTION 'comment article hash does not match its article'
          USING ERRCODE = '23514', CONSTRAINT = 'comments_article_hash_matches_article';
      END IF;

      RETURN NEW;
    END
    $$
    """)

    execute("""
    CREATE TRIGGER comments_article_hash_matches_article
    BEFORE INSERT OR UPDATE OF article_hash_id, thread, post_id, blog_id, changelog_id, doc_id
    ON cms.comments
    FOR EACH ROW
    EXECUTE PROCEDURE cms.ensure_comment_article_hash_matches_article()
    """)
  end

  def down do
    execute("DROP TRIGGER IF EXISTS comments_article_hash_matches_article ON cms.comments")
    execute("DROP FUNCTION IF EXISTS cms.ensure_comment_article_hash_matches_article()")

    drop_if_exists(
      index(:comments, [:community_id, :thread, :article_hash_id], prefix: @cms_prefix)
    )

    alter table(:comments, prefix: @cms_prefix) do
      remove(:article_hash_id)
    end
  end
end
