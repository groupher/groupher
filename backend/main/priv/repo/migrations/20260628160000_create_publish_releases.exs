defmodule GroupherServer.Repo.Migrations.CreatePublishReleases do
  use Ecto.Migration

  @prefix "cms"

  def change do
    create_if_not_exists table(:publish_releases, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(
        :tree_snapshot_id,
        references(:doc_tree_snapshots, prefix: @prefix, on_delete: :nilify_all)
      )

      add(:release_number, :integer, null: false)
      add(:author_id, references(:users, prefix: "account", on_delete: :nilify_all))
      add(:published_at, :timestamptz, null: false)

      timestamps()
    end

    create_if_not_exists(index(:publish_releases, [:community_id], prefix: @prefix))
    create_if_not_exists(index(:publish_releases, [:tree_snapshot_id], prefix: @prefix))
    create_if_not_exists(index(:publish_releases, [:published_at], prefix: @prefix))

    create_if_not_exists(
      unique_index(:publish_releases, [:community_id, :release_number],
        prefix: @prefix,
        name: :publish_releases_community_number_index
      )
    )

    create_if_not_exists table(:publish_release_articles, prefix: @prefix) do
      add(:release_id, references(:publish_releases, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:article_id, :bigint, null: false)

      add(
        :snapshot_id,
        references(:article_snapshots, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:node_id, :string)
      add(:group_node_id, :string)
      add(:index, :integer)
      add(:title, :string, null: false)
      add(:actions, {:array, :string}, null: false, default: [])

      timestamps()
    end

    create_if_not_exists(index(:publish_release_articles, [:release_id], prefix: @prefix))
    create_if_not_exists(index(:publish_release_articles, [:article_id], prefix: @prefix))

    create_if_not_exists(
      index(:publish_release_articles, [:snapshot_id], prefix: @prefix)
    )

    create_if_not_exists(index(:publish_release_articles, [:node_id], prefix: @prefix))

    create_if_not_exists table(:publish_release_tree_events, prefix: @prefix) do
      add(:release_id, references(:publish_releases, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(
        :doc_tree_event_id,
        references(:doc_tree_events, prefix: @prefix, on_delete: :nilify_all)
      )

      add(:event_type, :string, null: false)
      add(:label, :string, null: false)
      add(:payload, :map, null: false)
      add(:inverse_payload, :map, null: false)

      timestamps()
    end

    create_if_not_exists(index(:publish_release_tree_events, [:release_id], prefix: @prefix))

    create_if_not_exists(
      index(:publish_release_tree_events, [:doc_tree_event_id], prefix: @prefix)
    )
  end
end
