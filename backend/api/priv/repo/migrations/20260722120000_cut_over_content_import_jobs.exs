defmodule GroupherServer.Repo.Migrations.CutOverContentImportJobs do
  use Ecto.Migration

  @prefix "cms"

  def up do
    drop_if_exists(table(:content_import_job_assets, prefix: @prefix))
    drop_if_exists(table(:content_import_mappings, prefix: @prefix))
    drop_if_exists(table(:content_import_job_items, prefix: @prefix))
    drop_if_exists(table(:content_import_jobs, prefix: @prefix))
    drop_if_exists(table(:content_import_snapshots, prefix: @prefix))

    create table(:content_import_jobs, prefix: @prefix) do
      add(:hash_id, :uuid, null: false)

      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(
        :connection_id,
        references(:content_import_connections, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:actor_id, references(:users, prefix: "account", on_delete: :nilify_all))
      add(:thread, :string, null: false, default: "doc")
      add(:status, :string, null: false, default: "staging")
      add(:preview_ref, :string, null: false)
      add(:dataset_ref, :string, null: false)
      add(:source_info, :map, null: false)
      add(:target_revision, :string, null: false)
      add(:target_tree, :map, null: false)
      add(:bad_smells, {:array, :map}, null: false, default: [])
      add(:counts, :map, null: false, default: %{})
      add(:progress, :map, null: false, default: %{})
      add(:result, :map, null: false, default: %{})
      add(:error_code, :string)
      add(:error_message, :text)
      add(:completed_at, :timestamptz)

      timestamps()
    end

    create(unique_index(:content_import_jobs, [:hash_id], prefix: @prefix))

    create(
      unique_index(:content_import_jobs, [:community_id, :preview_ref],
        prefix: @prefix,
        name: :content_import_jobs_preview_index
      )
    )

    create(index(:content_import_jobs, [:community_id, :status, :inserted_at], prefix: @prefix))

    create(
      constraint(:content_import_jobs, :content_import_jobs_thread_check,
        prefix: @prefix,
        check: "thread = 'doc'"
      )
    )

    create(
      constraint(:content_import_jobs, :content_import_jobs_status_check,
        prefix: @prefix,
        check: "status IN ('staging', 'ready', 'applying', 'completed', 'failed', 'cancelled')"
      )
    )

    create table(:content_import_job_items, prefix: @prefix) do
      add(
        :job_id,
        references(:content_import_jobs, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:external_ref, :text, null: false)
      add(:target_ref, :uuid, null: false)
      add(:title, :string, null: false)
      add(:slug, :string, null: false)
      add(:route, :text, null: false)
      add(:source_revision, :string, null: false)
      add(:source_version, :string, null: false)
      add(:source_hash, :string, null: false)
      add(:source_updated_at, :timestamptz)
      add(:selected, :boolean, null: false, default: true)
      add(:content_status, :string, null: false, default: "pending")
      add(:skip_code, :string)
      add(:body_hash, :string)
      add(:metadata, :map, null: false, default: %{})

      timestamps()
    end

    create(
      unique_index(:content_import_job_items, [:job_id, :external_ref],
        prefix: @prefix,
        name: :content_import_job_items_job_source_index
      )
    )

    create(index(:content_import_job_items, [:job_id, :content_status], prefix: @prefix))

    create(
      constraint(:content_import_job_items, :content_import_job_items_status_check,
        prefix: @prefix,
        check: "content_status IN ('pending', 'ready', 'skipped')"
      )
    )

    create table(:content_import_job_bodies, prefix: @prefix) do
      add(
        :job_id,
        references(:content_import_jobs, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(
        :job_item_id,
        references(:content_import_job_items, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:external_ref, :text, null: false)
      add(:body_bag, :map, null: false)
      add(:body_hash, :string, null: false)
      add(:body_size_bytes, :bigint, null: false)

      timestamps()
    end

    create(
      unique_index(:content_import_job_bodies, [:job_id, :external_ref],
        prefix: @prefix,
        name: :content_import_job_bodies_job_source_index
      )
    )

    create(unique_index(:content_import_job_bodies, [:job_item_id], prefix: @prefix))

    create table(:content_import_source_mappings, prefix: @prefix) do
      add(
        :connection_id,
        references(:content_import_connections, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:thread, :string, null: false)
      add(:external_ref, :text, null: false)
      add(:thread_ref, :uuid, null: false)
      add(:source_revision, :string)
      add(:source_version, :string, null: false)
      add(:source_hash, :string, null: false)
      add(:groupher_hash, :string, null: false)
      add(:source_updated_at, :timestamptz)
      add(:last_checked_at, :timestamptz, null: false)
      add(:last_imported_at, :timestamptz, null: false)

      timestamps()
    end

    create(
      unique_index(:content_import_source_mappings, [:connection_id, :thread, :external_ref],
        prefix: @prefix,
        name: :content_import_source_mappings_source_index
      )
    )

    create(index(:content_import_source_mappings, [:thread, :thread_ref], prefix: @prefix))

    create(
      constraint(:content_import_source_mappings, :content_import_source_mappings_thread_check,
        prefix: @prefix,
        check: "thread = 'doc'"
      )
    )
  end

  def down do
    raise "content import cutover intentionally drops non-production legacy import state"
  end
end
