defmodule GroupherServer.Repo.Migrations.AddUniqueIndexesToCommunityJoinTags do
  use Ecto.Migration

  @article_fields [:post_id, :blog_id, :changelog_id, :doc_id]

  def up do
    Enum.each(@article_fields, &assert_no_duplicates/1)

    Enum.each(@article_fields, fn article_field ->
      drop_if_exists(
        index(:community_join_tags, [:community_tag_id, article_field], prefix: "cms")
      )

      create(
        unique_index(:community_join_tags, [:community_tag_id, article_field],
          prefix: "cms",
          where: "#{article_field} IS NOT NULL"
        )
      )
    end)
  end

  def down do
    Enum.each(@article_fields, fn article_field ->
      drop(unique_index(:community_join_tags, [:community_tag_id, article_field], prefix: "cms"))
    end)

    Enum.each([:post_id, :blog_id, :changelog_id], fn article_field ->
      create(index(:community_join_tags, [:community_tag_id, article_field], prefix: "cms"))
    end)
  end

  defp assert_no_duplicates(article_field) do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM cms.community_join_tags
        WHERE #{article_field} IS NOT NULL
        GROUP BY community_tag_id, #{article_field}
        HAVING COUNT(*) > 1
      ) THEN
        RAISE EXCEPTION
          'cannot create unique community tag association index; duplicate rows exist for #{article_field}';
      END IF;
    END
    $$;
    """)
  end
end
