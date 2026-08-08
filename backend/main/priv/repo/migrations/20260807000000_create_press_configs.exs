defmodule GroupherServer.Repo.Migrations.CreatePressConfigs do
  use Ecto.Migration

  def up do
    create table(:press_configs, prefix: "cms") do
      add(:community_id, references(:communities, prefix: "cms", on_delete: :delete_all),
        null: false
      )

      add(:markdown_enabled, :boolean, null: false, default: true)
      add(:feed_enabled, :boolean, null: false, default: false)
      add(:feed_type, :string, null: false, default: "digest")
      add(:feed_count, :integer, null: false, default: 20)
      add(:feed_threads, {:array, :string}, null: false, default: [])
      add(:llms_enabled, :boolean, null: false, default: true)
      add(:sitemap_enabled, :boolean, null: false, default: true)
      add(:revision, :bigint, null: false, default: 1)

      timestamps()
    end

    create(unique_index(:press_configs, [:community_id], prefix: "cms"))

    create(
      constraint(:press_configs, :press_configs_feed_type_check,
        prefix: "cms",
        check: "feed_type IN ('digest', 'full')"
      )
    )

    create(
      constraint(:press_configs, :press_configs_feed_count_check,
        prefix: "cms",
        check: "feed_count >= 5 AND feed_count <= 50"
      )
    )

    execute("""
    INSERT INTO cms.press_configs
      (community_id, feed_type, feed_count, inserted_at, updated_at)
    SELECT
      community_id,
      CASE WHEN rss->>'rss_feed_type' IN ('digest', 'full')
        THEN rss->>'rss_feed_type' ELSE 'digest' END,
      LEAST(GREATEST(COALESCE((rss->>'rss_feed_count')::integer, 20), 5), 50),
      NOW(),
      NOW()
    FROM cms.community_dashboards
    ON CONFLICT (community_id) DO NOTHING
    """)
  end

  def down do
    drop(table(:press_configs, prefix: "cms"))
  end
end
