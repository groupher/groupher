defmodule GroupherServer.Repo.Migrations.ContractCommandReceiptsToConfirmation do
  use Ecto.Migration

  def up do
    # Historical receipts intentionally have no compatibility contract after
    # this schema cutover. Clearing them also prevents legacy rows from
    # shadowing new claims under the unchanged uniqueness constraint.
    execute("DELETE FROM cms.command_receipts")

    alter table(:command_receipts, prefix: "cms") do
      remove(:payload_fingerprint)
      remove(:intent_fingerprint)
      remove(:outcome)
      remove(:result_key)
      remove(:result_payload)
    end
  end

  def down do
    alter table(:command_receipts, prefix: "cms") do
      add(:payload_fingerprint, :string)
      add(:intent_fingerprint, :string)
      add(:outcome, :string)
      add(:result_key, :string)
      add(:result_payload, :map)
    end
  end
end
