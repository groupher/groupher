defmodule GroupherServer.Repo.Migrations.RepairDocTreeEventsColumns do
  use Ecto.Migration

  @prefix "cms"

  def up do
    create_doc_tree_events_if_missing()
    ensure_doc_tree_events_columns()
    create_doc_tree_events_indexes()
  end

  def down do
    :ok
  end

  defp create_doc_tree_events_if_missing do
    create_if_not_exists table(:doc_tree_events, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:seq, :integer, null: false)
      add(:event_type, :string, null: false)
      add(:payload, :map, null: false)
      add(:inverse_payload, :map, null: false)
      add(:status, :string, null: false, default: "staged")
      add(:owner, :string, null: false, default: "tree")
      add(:workspace_id, :bigint)
      add(:author_id, references(:users, prefix: "account", on_delete: :nilify_all))

      add(
        :snapshot_id,
        references(:doc_tree_snapshots, prefix: @prefix, on_delete: :nilify_all)
      )

      add(
        :reverted_by_event_id,
        references(:doc_tree_events, prefix: @prefix, on_delete: :nilify_all)
      )

      timestamps()
    end
  end

  defp ensure_doc_tree_events_columns do
    add_column_if_missing(:doc_tree_events, :seq, "integer NOT NULL DEFAULT 1")
    add_column_if_missing(:doc_tree_events, :event_type, "varchar NOT NULL DEFAULT 'node.update'")
    add_column_if_missing(:doc_tree_events, :payload, "jsonb NOT NULL DEFAULT '{}'")
    add_column_if_missing(:doc_tree_events, :inverse_payload, "jsonb NOT NULL DEFAULT '{}'")
    add_column_if_missing(:doc_tree_events, :status, "varchar NOT NULL DEFAULT 'staged'")
    add_column_if_missing(:doc_tree_events, :owner, "varchar NOT NULL DEFAULT 'tree'")
    add_column_if_missing(:doc_tree_events, :workspace_id, "bigint")

    add_column_if_missing(
      :doc_tree_events,
      :author_id,
      "bigint REFERENCES account.users(id) ON DELETE SET NULL"
    )

    add_column_if_missing(
      :doc_tree_events,
      :snapshot_id,
      "bigint REFERENCES #{@prefix}.doc_tree_snapshots(id) ON DELETE SET NULL"
    )

    add_column_if_missing(
      :doc_tree_events,
      :reverted_by_event_id,
      "bigint REFERENCES #{@prefix}.doc_tree_events(id) ON DELETE SET NULL"
    )

    add_column_if_missing(:doc_tree_events, :inserted_at, "timestamp(0) without time zone")
    add_column_if_missing(:doc_tree_events, :updated_at, "timestamp(0) without time zone")
  end

  defp create_doc_tree_events_indexes do
    create_if_not_exists(index(:doc_tree_events, [:community_id], prefix: @prefix))
    create_if_not_exists(index(:doc_tree_events, [:community_id, :status], prefix: @prefix))

    create_if_not_exists(
      index(:doc_tree_events, [:community_id, :status, :owner], prefix: @prefix)
    )

    create_if_not_exists(
      index(:doc_tree_events, [:community_id, :owner, :workspace_id, :status], prefix: @prefix)
    )

    create_if_not_exists(index(:doc_tree_events, [:snapshot_id], prefix: @prefix))

    create_if_not_exists(
      unique_index(:doc_tree_events, [:community_id, :seq],
        prefix: @prefix,
        name: :doc_tree_events_community_seq_index
      )
    )
  end

  defp add_column_if_missing(table, column, definition) do
    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.#{table}') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = '#{@prefix}'
            AND table_name = '#{table}'
            AND column_name = '#{column}'
        )
      THEN
        ALTER TABLE #{@prefix}.#{table}
          ADD COLUMN #{column} #{definition};
      END IF;
    END
    $$;
    """)
  end
end
