defmodule GroupherServer.Repo.Migrations.GlobalizeSharedCommentReviewBlocks do
  use Ecto.Migration

  def up do
    execute("""
    UPDATE cms.comment_review_blocks AS block
    SET community_id = NULL
    FROM cms.comments AS comment
    WHERE block.comment_id = comment.id
      AND block.community_id IS NOT NULL
      AND comment.thread <> 'doc'
    """)

    execute("""
    CREATE FUNCTION cms.enforce_comment_review_block_scope() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.community_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM cms.comments AS comment
        WHERE comment.id = NEW.comment_id AND comment.thread <> 'doc'
      ) THEN
        RAISE EXCEPTION 'ordinary Comment review blocks must be global'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER enforce_comment_review_block_scope
    BEFORE INSERT OR UPDATE OF comment_id, community_id
    ON cms.comment_review_blocks
    FOR EACH ROW EXECUTE FUNCTION cms.enforce_comment_review_block_scope()
    """)
  end

  def down do
    execute("DROP TRIGGER IF EXISTS enforce_comment_review_block_scope ON cms.comment_review_blocks")
    execute("DROP FUNCTION IF EXISTS cms.enforce_comment_review_block_scope()")
  end
end
