defmodule GroupherServer.Repo.Migrations.CreateOauthFlows do
  use Ecto.Migration

  def change do
    create table(:oauth_flows, prefix: "account") do
      add(:ref, :string, null: false)
      add(:purpose, :string, null: false)
      add(:status, :string, null: false)
      add(:provider, :string, null: false)
      add(:identity, :map)
      add(:browser_session_ref, :string)
      add(:code_verifier, :string)
      add(:nonce, :string)
      add(:return_to, :text)
      add(:expires_at, :timestamptz, null: false)
      timestamps()
    end

    create(unique_index(:oauth_flows, [:ref], prefix: "account"))
    create(index(:oauth_flows, [:expires_at], prefix: "account"))
  end
end
