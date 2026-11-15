defmodule GroupherServer.Repo.Migrations.ConvergeDocReviewTargets do
  use Ecto.Migration

  @cms "cms"
  @wall "alert_wall"
  @review_bot "review_bot"

  def up do
    execute("DROP INDEX IF EXISTS #{@cms}.artiment_reviews_current_doc_index")

    execute(
      "ALTER TABLE #{@cms}.artiment_reviews DROP CONSTRAINT IF EXISTS artiment_reviews_target_refs_check"
    )

    execute("""
    UPDATE #{@cms}.artiment_reviews
    SET target_type = 'article'
    WHERE target_type = 'doc'
    """)

    execute("""
    ALTER TABLE #{@cms}.artiment_reviews
    ADD CONSTRAINT artiment_reviews_target_refs_check
    CHECK ((target_type = 'article' AND article_id IS NOT NULL AND comment_id IS NULL)
        OR (target_type = 'comment' AND article_id IS NULL AND comment_id IS NOT NULL))
    """)

    execute("""
    DO $$
    DECLARE doc_config record;
    DECLARE article_config record;
    BEGIN
      FOR doc_config IN
        SELECT * FROM #{@review_bot}.review_bot_configs WHERE subject_type = 'doc'
      LOOP
        SELECT * INTO article_config
        FROM #{@review_bot}.review_bot_configs
        WHERE subject_type = 'article'
          AND community_id IS NOT DISTINCT FROM doc_config.community_id;

        IF FOUND THEN
          IF article_config.ban_words IS DISTINCT FROM doc_config.ban_words OR
             article_config.prompt IS DISTINCT FROM doc_config.prompt OR
             article_config.review_mode IS DISTINCT FROM doc_config.review_mode THEN
            RAISE EXCEPTION 'Doc and Article review configs conflict in the same scope';
          END IF;

          DELETE FROM #{@review_bot}.review_bot_configs WHERE id = doc_config.id;
        ELSE
          UPDATE #{@review_bot}.review_bot_configs
          SET subject_type = 'article'
          WHERE id = doc_config.id;
        END IF;
      END LOOP;
    END $$;
    """)

    execute(
      "ALTER TABLE #{@review_bot}.review_bot_configs DROP CONSTRAINT IF EXISTS review_bot_configs_subject_type_check"
    )

    execute("""
    ALTER TABLE #{@review_bot}.review_bot_configs
    ADD CONSTRAINT review_bot_configs_subject_type_check
    CHECK (subject_type IN ('article', 'comment'))
    """)

    execute(
      "ALTER TABLE #{@wall}.items DROP CONSTRAINT IF EXISTS alert_wall_items_target_type_check"
    )

    execute("UPDATE #{@wall}.items SET target_type = 'article' WHERE target_type = 'doc'")
    execute("UPDATE #{@wall}.user_reports SET target_type = 'article' WHERE target_type = 'doc'")

    execute("""
    ALTER TABLE #{@wall}.items
    ADD CONSTRAINT alert_wall_items_target_type_check
    CHECK (target_type IN ('article', 'comment', 'user'))
    """)
  end

  def down do
    raise "Doc review targets do not restore the retired Doc target"
  end
end
