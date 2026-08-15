defmodule GroupherServer.Repo.Migrations.AddCommunityIdToComments do
  use Ecto.Migration

  def up do
    alter table(:comments, prefix: "cms") do
      add(:community_id, references(:communities, on_delete: :delete_all), null: true)
    end

    for {table, foreign_key} <- [
          {"posts", "post_id"},
          {"blogs", "blog_id"},
          {"changelogs", "changelog_id"},
          {"docs", "doc_id"}
        ] do
      execute("""
      UPDATE cms.comments AS comment
      SET community_id = article.community_id
      FROM cms.#{table} AS article
      WHERE comment.#{foreign_key} = article.id
      """)
    end

    execute("""
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM cms.comments WHERE community_id IS NULL) THEN
        RAISE EXCEPTION 'cannot backfill cms.comments.community_id';
      END IF;
    END
    $$
    """)

    alter table(:comments, prefix: "cms") do
      modify(:community_id, :bigint, null: false)
    end

    create(index(:comments, [:community_id], prefix: "cms"))
    create(index(:comments, [:community_id, :thread], prefix: "cms"))

    execute("""
    CREATE FUNCTION cms.ensure_comment_community_matches_article()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      expected_community_id bigint;
    BEGIN
      CASE
        WHEN NEW.post_id IS NOT NULL THEN
          SELECT community_id INTO expected_community_id FROM cms.posts WHERE id = NEW.post_id;
        WHEN NEW.blog_id IS NOT NULL THEN
          SELECT community_id INTO expected_community_id FROM cms.blogs WHERE id = NEW.blog_id;
        WHEN NEW.changelog_id IS NOT NULL THEN
          SELECT community_id INTO expected_community_id FROM cms.changelogs WHERE id = NEW.changelog_id;
        WHEN NEW.doc_id IS NOT NULL THEN
          SELECT community_id INTO expected_community_id FROM cms.docs WHERE id = NEW.doc_id;
      END CASE;

      IF expected_community_id IS NULL OR expected_community_id <> NEW.community_id THEN
        RAISE EXCEPTION 'comment community does not match its article'
          USING ERRCODE = '23514', CONSTRAINT = 'comments_community_matches_article';
      END IF;

      RETURN NEW;
    END
    $$
    """)

    execute("""
    CREATE TRIGGER comments_community_matches_article
    BEFORE INSERT OR UPDATE OF community_id, thread, post_id, blog_id, changelog_id, doc_id
    ON cms.comments
    FOR EACH ROW
    EXECUTE PROCEDURE cms.ensure_comment_community_matches_article()
    """)
  end

  def down do
    execute("DROP TRIGGER IF EXISTS comments_community_matches_article ON cms.comments")
    execute("DROP FUNCTION IF EXISTS cms.ensure_comment_community_matches_article()")

    drop_if_exists(index(:comments, [:community_id, :thread], prefix: "cms"))
    drop_if_exists(index(:comments, [:community_id], prefix: "cms"))

    alter table(:comments, prefix: "cms") do
      remove(:community_id)
    end
  end
end
