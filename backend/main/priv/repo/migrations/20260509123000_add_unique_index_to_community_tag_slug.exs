defmodule GroupherServer.Repo.Migrations.AddUniqueIndexToCommunityTagSlug do
  use Ecto.Migration

  def up do
    execute("""
    DO $$
    DECLARE
      duplicate_groups text;
    BEGIN
      SELECT string_agg(
        format(
          '(community_id=%s, thread=%s, slug=%s, ids=%s)',
          community_id,
          thread,
          slug,
          ids
        ),
        ', '
      )
      INTO duplicate_groups
      FROM (
        SELECT community_id, thread, slug, array_agg(id ORDER BY id) AS ids
        FROM cms.community_tags
        GROUP BY community_id, thread, slug
        HAVING COUNT(*) > 1
      ) duplicates;

      IF duplicate_groups IS NOT NULL THEN
        RAISE EXCEPTION
          'cannot create community_tags community/thread/slug unique index; duplicate rows exist: %',
          duplicate_groups;
      END IF;
    END $$;
    """)

    create(
      unique_index(:community_tags, [:community_id, :thread, :slug],
        prefix: "cms",
        name: :community_tags_community_id_thread_slug_index
      )
    )
  end

  def down do
    drop(
      unique_index(:community_tags, [:community_id, :thread, :slug],
        prefix: "cms",
        name: :community_tags_community_id_thread_slug_index
      )
    )
  end
end
