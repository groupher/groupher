defmodule GroupherServer.Repo.Migrations.FixOauthProvidersUniqueIndexAndAddRaw do
  use Ecto.Migration

  def up do
    alter table(:oauth_providers, prefix: "account") do
      add(:raw, :map)
    end

    # previously: unique_index(:oauth_providers, [:user_id, :provider, :provider_id])
    # the lookup in signin_oauth is by provider + provider_id, so we make it unique globally
    create unique_index(:oauth_providers, [:provider, :provider_id], prefix: "account")

    drop_if_exists(index(:oauth_providers, [:user_id, :provider, :provider_id], prefix: "account"))
  end

  def down do
    drop_if_exists(index(:oauth_providers, [:provider, :provider_id], prefix: "account"))

    create unique_index(:oauth_providers, [:user_id, :provider, :provider_id], prefix: "account")

    alter table(:oauth_providers, prefix: "account") do
      remove(:raw)
    end
  end
end
