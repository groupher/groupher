defmodule GroupherServer.Repo.Migrations.RepairPublishReleaseTables do
  use Ecto.Migration

  @prefix "cms"

  def up do
    create_publish_releases_if_missing()
    ensure_publish_releases_tree_snapshot_id()
    create_publish_release_articles_if_missing()
    create_publish_release_tree_events_if_missing()
  end

  def down do
    :ok
  end

  defp create_publish_releases_if_missing do
    create_if_not_exists table(:publish_releases, prefix: @prefix) do
      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(
        :tree_snapshot_id,
        references(:doc_tree_snapshots, prefix: @prefix, on_delete: :nilify_all)
      )

      add(:release_number, :integer, null: false)
      add(:author_id, references(:users, prefix: "account", on_delete: :nilify_all))
      add(:published_at, :timestamptz, null: false)

      timestamps()
    end

    create_if_not_exists(index(:publish_releases, [:community_id], prefix: @prefix))
    create_if_not_exists(index(:publish_releases, [:published_at], prefix: @prefix))

    create_if_not_exists(
      unique_index(:publish_releases, [:community_id, :release_number],
        prefix: @prefix,
        name: :publish_releases_community_number_index
      )
    )
  end

  defp ensure_publish_releases_tree_snapshot_id do
    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.publish_releases') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = '#{@prefix}'
            AND table_name = 'publish_releases'
            AND column_name = 'tree_snapshot_id'
        )
      THEN
        ALTER TABLE #{@prefix}.publish_releases
          ADD COLUMN tree_snapshot_id bigint;
      END IF;
    END
    $$;
    """)

    execute("""
    DO $$
    BEGIN
      IF to_regclass('#{@prefix}.publish_releases') IS NOT NULL
        AND to_regclass('#{@prefix}.doc_tree_snapshots') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = '#{@prefix}'
            AND table_name = 'publish_releases'
            AND column_name = 'tree_snapshot_id'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_namespace n ON n.oid = c.connamespace
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE n.nspname = '#{@prefix}'
            AND t.relname = 'publish_releases'
            AND c.conname = 'publish_releases_tree_snapshot_id_fkey'
        )
      THEN
        ALTER TABLE #{@prefix}.publish_releases
          ADD CONSTRAINT publish_releases_tree_snapshot_id_fkey
          FOREIGN KEY (tree_snapshot_id)
          REFERENCES #{@prefix}.doc_tree_snapshots(id)
          ON DELETE SET NULL;
      END IF;
    END
    $$;
    """)

    create_if_not_exists(index(:publish_releases, [:tree_snapshot_id], prefix: @prefix))
  end

  defp create_publish_release_articles_if_missing do
    create_if_not_exists table(:publish_release_articles, prefix: @prefix) do
      add(:release_id, references(:publish_releases, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:doc_id, :uuid, null: false)

      add(
        :snapshot_id,
        references(:article_snapshots, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:node_id, :string)
      add(:group_node_id, :string)
      add(:index, :integer)
      add(:title, :string, null: false)
      add(:actions, {:array, :string}, null: false, default: [])

      timestamps()
    end

    ensure_publish_release_articles_columns()

    create_if_not_exists(index(:publish_release_articles, [:release_id], prefix: @prefix))
    create_if_not_exists(index(:publish_release_articles, [:doc_id], prefix: @prefix))
    create_if_not_exists(index(:publish_release_articles, [:snapshot_id], prefix: @prefix))
    create_if_not_exists(index(:publish_release_articles, [:node_id], prefix: @prefix))
  end

  defp create_publish_release_tree_events_if_missing do
    create_if_not_exists table(:publish_release_tree_events, prefix: @prefix) do
      add(:release_id, references(:publish_releases, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(
        :doc_tree_event_id,
        references(:doc_tree_events, prefix: @prefix, on_delete: :nilify_all)
      )

      add(:event_type, :string, null: false)
      add(:label, :string, null: false)
      add(:payload, :map, null: false)
      add(:inverse_payload, :map, null: false)

      timestamps()
    end

    ensure_publish_release_tree_events_columns()

    create_if_not_exists(index(:publish_release_tree_events, [:release_id], prefix: @prefix))

    create_if_not_exists(
      index(:publish_release_tree_events, [:doc_tree_event_id], prefix: @prefix)
    )
  end

  defp ensure_publish_release_articles_columns do
    add_column_if_missing(
      :publish_release_articles,
      :release_id,
      "bigint REFERENCES #{@prefix}.publish_releases(id) ON DELETE CASCADE"
    )

    add_column_if_missing(:publish_release_articles, :doc_id, "uuid")

    add_column_if_missing(
      :publish_release_articles,
      :snapshot_id,
      "bigint REFERENCES #{@prefix}.article_snapshots(id) ON DELETE RESTRICT"
    )

    add_column_if_missing(:publish_release_articles, :node_id, "varchar")
    add_column_if_missing(:publish_release_articles, :group_node_id, "varchar")
    add_column_if_missing(:publish_release_articles, :index, "integer")
    add_column_if_missing(:publish_release_articles, :title, "varchar")
    add_column_if_missing(:publish_release_articles, :actions, "varchar[] NOT NULL DEFAULT '{}'")

    add_column_if_missing(
      :publish_release_articles,
      :inserted_at,
      "timestamp(0) without time zone"
    )

    add_column_if_missing(
      :publish_release_articles,
      :updated_at,
      "timestamp(0) without time zone"
    )
  end

  defp ensure_publish_release_tree_events_columns do
    add_column_if_missing(
      :publish_release_tree_events,
      :release_id,
      "bigint REFERENCES #{@prefix}.publish_releases(id) ON DELETE CASCADE"
    )

    add_column_if_missing(
      :publish_release_tree_events,
      :doc_tree_event_id,
      "bigint REFERENCES #{@prefix}.doc_tree_events(id) ON DELETE SET NULL"
    )

    add_column_if_missing(:publish_release_tree_events, :event_type, "varchar")
    add_column_if_missing(:publish_release_tree_events, :label, "varchar")
    add_column_if_missing(:publish_release_tree_events, :payload, "jsonb")
    add_column_if_missing(:publish_release_tree_events, :inverse_payload, "jsonb")

    add_column_if_missing(
      :publish_release_tree_events,
      :inserted_at,
      "timestamp(0) without time zone"
    )

    add_column_if_missing(
      :publish_release_tree_events,
      :updated_at,
      "timestamp(0) without time zone"
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
