defmodule GroupherServer.Repo.Migrations.CreateArtimentMentions do
  use Ecto.Migration

  @prefix "cms"

  def change do
    create table(:artiment_mentions, prefix: @prefix) do
      add(:mentioner_type, :string, null: false)
      add(:mentioner_id, :id, null: false)
      add(:mentioner_community_id, references(:communities, on_delete: :delete_all), null: false)
      add(:mentioner_url, :string)

      add(:mentioned_scope, :string, null: false)
      add(:mentioned_type, :string, null: false)
      add(:mentioned_id, :id)
      add(:mentioned_community_id, references(:communities, on_delete: :nilify_all))
      add(:mentioned_url, :string)
      add(:mentioned_url_hash, :string)

      add(:mention_case, :string, null: false)
      add(:occurrences, {:array, :map}, default: [], null: false)
      add(:mentioner_snapshot, :map, default: %{}, null: false)
      add(:mentioned_snapshot, :map, default: %{}, null: false)
      add(:meta, :map, default: %{}, null: false)
      add(:mentioned_at, :utc_datetime, null: false)

      timestamps(type: :utc_datetime)
    end

    create(
      index(:artiment_mentions, [:mentioner_type, :mentioner_id],
        prefix: @prefix,
        name: :artiment_mentions_mentioner_index
      )
    )

    create(
      index(:artiment_mentions, [:mentioner_community_id, :mentioner_type, :mentioner_id],
        prefix: @prefix,
        name: :artiment_mentions_mentioner_community_index
      )
    )

    create(
      index(:artiment_mentions, [:mentioned_scope, :mentioned_type, :mentioned_id],
        prefix: @prefix,
        name: :artiment_mentions_mentioned_internal_index
      )
    )

    create(
      index(
        :artiment_mentions,
        [:mentioned_community_id, :mentioned_scope, :mentioned_type, :mentioned_id],
        prefix: @prefix,
        name: :artiment_mentions_mentioned_community_index
      )
    )

    create(
      index(:artiment_mentions, [:mentioned_url_hash],
        prefix: @prefix,
        name: :artiment_mentions_mentioned_url_hash_index
      )
    )
  end
end
