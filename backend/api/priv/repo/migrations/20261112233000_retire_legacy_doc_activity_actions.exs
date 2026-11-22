defmodule GroupherServer.Repo.Migrations.RetireLegacyDocActivityActions do
  use Ecto.Migration

  def up do
    # No historical event conversion: R8 clears obsolete content before migration.
    # Any overlooked legacy event makes the new constraint fail atomically.
    drop(constraint(:doc_logs, :doc_logs_action_check, prefix: "activity"))

    create(
      constraint(:doc_logs, :doc_logs_action_check,
        prefix: "activity",
        check:
          "action IN ('created','title_changed','body_updated','published','trashed','restored','archived','permanently_deleted','comment_created','comment_updated')"
      )
    )
  end

  def down, do: raise("Legacy Doc activity actions are intentionally retired")
end
