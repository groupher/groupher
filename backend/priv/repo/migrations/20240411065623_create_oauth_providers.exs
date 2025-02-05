defmodule GroupherServer.Repo.Migrations.CreateOauthProviders do
  use Ecto.Migration

  def change do
    create table(:oauth_providers, prefix: "account") do
      add(:provider, :string)
      add(:provider_id, :string)
      add(:login, :string)
      add(:nickname, :string)
      add(:avatar, :string)
      add(:email, :string)
      add(:locale, :string)
      add(:link, :string)
      add(:bio, :string)
      add(:country, :string)
      add(:city, :string)
      add(:company, :string)

      add(:user_id, references(:users, prefix: "account"))
    end

    create unique_index(:oauth_providers, [:user_id, :provider, :provider_id], prefix: "account")
  end
end
