defmodule GroupherServer.Repo.Migrations.DropPaymentAndCustomization do
  use Ecto.Migration

  def up do
    drop_if_exists table(:bills, prefix: "payment")
    execute "DROP SCHEMA IF EXISTS payment"

    drop_if_exists table(:customizations, prefix: "account")
    drop_if_exists table(:purchases)
  end

  def down do
    execute "CREATE SCHEMA IF NOT EXISTS payment"

    create_if_not_exists table(:bills, prefix: "payment") do
      add :user_id, references(:users, prefix: "account", on_delete: :nothing)
      add :state, :string
      add :amount, :float
      add :hash_id, :string
      add :payment_usage, :string
      add :payment_method, :string
      add :note, :string

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists index(:bills, [:user_id], prefix: "payment")
    create_if_not_exists index(:bills, [:hash_id], prefix: "payment")

    create_if_not_exists table(:customizations, prefix: "account") do
      add :user_id, references(:users, prefix: "account", on_delete: :nothing)
      add :theme, :string
      add :sidebar_layout, :map
      add :sidebar_communities_index, :map
      add :community_chart, :boolean
      add :brainwash_free, :boolean
      add :banner_layout, :string
      add :contents_layout, :string
      add :content_divider, :boolean
      add :content_hover, :boolean
      add :mark_viewed, :boolean
      add :display_density, :string

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists unique_index(:customizations, [:user_id], prefix: "account")

    create_if_not_exists table(:purchases) do
      add :user_id, references(:users, prefix: "account", on_delete: :nothing)
      add :theme, :boolean
      add :community_chart, :boolean
      add :brainwash_free, :boolean

      timestamps(type: :utc_datetime)
    end

    create_if_not_exists unique_index(:purchases, [:user_id])
  end
end
