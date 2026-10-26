defmodule GroupherServer.Repo.Migrations.AddMentionDeliveryIdentity do
  use Ecto.Migration

  def change do
    alter table(:mentions, prefix: "messaging") do
      add(:target_key, :text)
      add(:content_token, :text)
    end

    create(
      unique_index(:mentions, [:target_key, :content_token, :to_user_id],
        prefix: "messaging",
        where: "target_key IS NOT NULL AND content_token IS NOT NULL",
        name: :mentions_delivery_identity_index
      )
    )
  end
end
