defmodule GroupherServer.Repo.Migrations.AddReceiptOperationRef do
  use Ecto.Migration

  def change do
    alter table(:command_receipts, prefix: "cms") do
      add(:operation_ref, :uuid, null: false, default: fragment("gen_random_uuid()"))
      add(:identity_version, :string, null: false, default: "legacy")
    end

    create(unique_index(:command_receipts, [:operation_ref], prefix: "cms"))

    create(
      constraint(:command_receipts, :command_receipts_identity_version_check,
        prefix: "cms",
        check: "identity_version IN ('legacy', 'scoped')"
      )
    )

    execute(
      "ALTER TABLE cms.command_receipts ALTER COLUMN identity_version SET DEFAULT 'scoped'",
      "ALTER TABLE cms.command_receipts ALTER COLUMN identity_version SET DEFAULT 'legacy'"
    )
  end
end
