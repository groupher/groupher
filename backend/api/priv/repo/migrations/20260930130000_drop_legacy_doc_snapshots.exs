defmodule GroupherServer.Repo.Migrations.DropLegacyDocSnapshots do
  @moduledoc "Removes the superseded DocSnapshot store after BranchVersion cutover."

  use Ecto.Migration

  @prefix "cms"

  @doc "Drops the legacy immutable DocSnapshot table."
  def up do
    drop_if_exists(table(:doc_snapshots, prefix: @prefix))
  end

  @doc "Reversal is intentionally unsupported for the direct cutover."
  def down do
    raise "DocSnapshot cutover is irreversible"
  end
end
