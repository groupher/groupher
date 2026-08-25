defmodule GroupherServer.Repo.Migrations.DropLegacyCmsAuditLogs do
  use Ecto.Migration

  @moduledoc """
  Completes the intentional Activity V1 cutover.

  The legacy CMS audit history is not migrated or exposed through Activity.
  Operations accepted direct destruction rather than an application-readable
  cold archive for V1; restoring this migration cannot reconstruct that data.
  """

  def up do
    drop_if_exists(table(:audit_logs, prefix: "cms"))
  end

  def down do
    raise "legacy cms.audit_logs deletion is intentionally irreversible"
  end
end
