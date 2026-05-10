defmodule GroupherServer.Repo.Migrations.CreateCommunityTagStats do
  use Ecto.Migration

  def change do
    create table(:community_tag_stats, prefix: "cms") do
      add(:community_tag_id, references(:community_tags, prefix: "cms", on_delete: :delete_all),
        null: false
      )

      add(:community_id, references(:communities, prefix: "cms", on_delete: :delete_all),
        null: false
      )

      add(:thread, :string, null: false)
      add(:contents_count, :integer, null: false, default: 0)
      add(:today_contents_count, :integer, null: false, default: 0)
      add(:today_stat_date, :date)

      timestamps()
    end

    create(unique_index(:community_tag_stats, [:community_tag_id], prefix: "cms"))
    create(index(:community_tag_stats, [:community_id, :thread], prefix: "cms"))

    create(index(:community_join_tags, [:community_tag_id, :post_id], prefix: "cms"))
    create(index(:community_join_tags, [:community_tag_id, :blog_id], prefix: "cms"))
    create(index(:community_join_tags, [:community_tag_id, :changelog_id], prefix: "cms"))
  end
end
