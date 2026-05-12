defmodule GroupherServer.Repo.Migrations.CreateCommunityTagGroups do
  use Ecto.Migration

  @cms_prefix "cms"

  def up do
    create table(:community_tag_groups, prefix: @cms_prefix) do
      add(:community_id, references(:communities, prefix: @cms_prefix, on_delete: :delete_all),
        null: false
      )

      add(:thread, :string, null: false)
      add(:title, :string, null: false)
      add(:index, :integer, null: false, default: 0)

      timestamps()
    end

    create(
      unique_index(:community_tag_groups, [:community_id, :thread, :title],
        prefix: @cms_prefix,
        name: :community_tag_groups_community_id_thread_title_index
      )
    )

    alter table(:community_tags, prefix: @cms_prefix) do
      add(
        :group_id,
        references(:community_tag_groups, prefix: @cms_prefix, on_delete: :delete_all)
      )
    end

    execute("""
    INSERT INTO #{@cms_prefix}.community_tag_groups (
      community_id,
      thread,
      title,
      index,
      inserted_at,
      updated_at
    )
    SELECT
      community_id,
      thread,
      title,
      ROW_NUMBER() OVER (
        PARTITION BY community_id, thread
        ORDER BY min_tag_index ASC, title ASC
      ) - 1 AS index,
      NOW(),
      NOW()
    FROM (
      SELECT
        community_id,
        thread,
        COALESCE(NULLIF("group", ''), 'Ungrouped') AS title,
        MIN("index") AS min_tag_index
      FROM #{@cms_prefix}.community_tags
      GROUP BY community_id, thread, COALESCE(NULLIF("group", ''), 'Ungrouped')
    ) grouped_tags
    """)

    execute("""
    UPDATE #{@cms_prefix}.community_tags AS tags
    SET group_id = groups.id
    FROM #{@cms_prefix}.community_tag_groups AS groups
    WHERE tags.community_id = groups.community_id
      AND tags.thread = groups.thread
      AND COALESCE(NULLIF(tags."group", ''), 'Ungrouped') = groups.title
    """)

    execute("ALTER TABLE #{@cms_prefix}.community_tags ALTER COLUMN group_id SET NOT NULL")

    create(index(:community_tags, [:group_id], prefix: @cms_prefix))
  end

  def down do
    drop(index(:community_tags, [:group_id], prefix: @cms_prefix))

    alter table(:community_tags, prefix: @cms_prefix) do
      remove(:group_id)
    end

    drop(
      unique_index(:community_tag_groups, [:community_id, :thread, :title],
        prefix: @cms_prefix,
        name: :community_tag_groups_community_id_thread_title_index
      )
    )

    drop(table(:community_tag_groups, prefix: @cms_prefix))
  end
end
