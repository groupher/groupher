defmodule GroupherServer.Repo.Migrations.MovePublicInnerIdToArticleCommunity do
  use Ecto.Migration

  @prefix "cms"

  def change do
    alter table(:article_communities, prefix: @prefix) do
      add(:inner_id, :bigint)
    end

    create(
      unique_index(:article_communities, [:community_id, :inner_id],
        prefix: @prefix,
        where: "inner_id IS NOT NULL",
        name: :article_communities_community_inner_id_index
      )
    )

    create table(:community_inner_id_counters, primary_key: false, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:next_inner_id, :bigint, null: false, default: 1)
    end
  end
end
