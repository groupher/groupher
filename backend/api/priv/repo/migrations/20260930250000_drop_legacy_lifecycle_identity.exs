defmodule GroupherServer.Repo.Migrations.DropLegacyLifecycleIdentity do
  use Ecto.Migration

  @moduledoc "Drops the retired physical Article hash keys from Lifecycle authorities."

  def up do
    execute("DROP INDEX IF EXISTS cms.article_lifecycles_identity_index")
    execute("DROP INDEX IF EXISTS cms.doc_lifecycles_identity_index")

    alter table(:article_lifecycles, prefix: "cms") do
      remove(:article_hash_id)
      modify(:article_id, :uuid, null: false)
    end

    alter table(:doc_lifecycles, prefix: "cms") do
      remove(:article_hash_id)
      modify(:article_id, :uuid, null: false)
    end
  end

  def down do
    alter table(:doc_lifecycles, prefix: "cms") do
      add(:article_hash_id, :uuid)
      modify(:article_id, :uuid, null: true)
    end

    alter table(:article_lifecycles, prefix: "cms") do
      add(:article_hash_id, :uuid)
      modify(:article_id, :uuid, null: true)
    end
  end
end
