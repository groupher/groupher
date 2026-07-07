defmodule GroupherServer.Repo.Migrations.CreateDocTreeRestoreAudits do
  use Ecto.Migration

  @prefix "cms"

  def change do
    create_if_not_exists table(:doc_tree_restore_audits, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:actor_id, references(:users, prefix: "account", on_delete: :nilify_all))
      add(:restored_event_ids, {:array, :integer}, null: false, default: [])
      add(:restored_node_ids, {:array, :string}, null: false, default: [])
      add(:restored_at, :timestamptz, null: false)
      add(:payload, :map, null: false, default: %{})

      timestamps()
    end

    create_if_not_exists(index(:doc_tree_restore_audits, [:community_id], prefix: @prefix))
    create_if_not_exists(index(:doc_tree_restore_audits, [:actor_id], prefix: @prefix))
    create_if_not_exists(index(:doc_tree_restore_audits, [:restored_at], prefix: @prefix))
  end
end
