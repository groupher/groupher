defmodule GroupherServer.Repo.Migrations.CreateContentImportFoundation do
  use Ecto.Migration

  @prefix "cms"

  def change do
    create table(:content_import_connections, prefix: @prefix) do
      add(:hash_id, :uuid, null: false)

      add(:community_id, references(:communities, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:platform, :string, null: false)
      add(:source_ref, :text, null: false)
      add(:connection_key, :string, null: false, default: "default")
      add(:status, :string, null: false, default: "active")
      add(:config, :map, null: false, default: %{})
      add(:credential_locator, :string)

      timestamps()
    end

    create(unique_index(:content_import_connections, [:hash_id], prefix: @prefix))

    create(
      unique_index(
        :content_import_connections,
        [:community_id, :platform, :source_ref, :connection_key],
        prefix: @prefix,
        name: :content_import_connections_source_index
      )
    )

    create(
      constraint(:content_import_connections, :content_import_connections_platform_check,
        prefix: @prefix,
        check: "platform IN ('github', 'archive', 'notion', 'sanity')"
      )
    )

    create(
      constraint(:content_import_connections, :content_import_connections_status_check,
        prefix: @prefix,
        check: "status IN ('active', 'disabled')"
      )
    )

    create table(:content_import_snapshots, prefix: @prefix) do
      add(
        :connection_id,
        references(:content_import_connections, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:revision, :string)
      add(:manifest_hash, :string, null: false)
      add(:manifest_hash_version, :integer, null: false)
      add(:entry_hash_version, :integer, null: false)
      add(:normalization_version, :integer, null: false)
      add(:adapter_version, :string)
      add(:checkpoint, :map, null: false, default: %{})
      add(:fetched_at, :timestamptz, null: false)
      add(:payload_ref, :text, null: false)
      add(:entry_count, :integer, null: false, default: 0)
      add(:entry_manifest, :map, null: false, default: %{})
      add(:diagnostics, :map, null: false, default: %{"items" => []})

      timestamps(updated_at: false)
    end

    create(
      unique_index(:content_import_snapshots, [:connection_id, :manifest_hash],
        prefix: @prefix,
        name: :content_import_snapshots_manifest_index
      )
    )

    create(index(:content_import_snapshots, [:connection_id, :inserted_at], prefix: @prefix))

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

      add(
        :snapshot_id,
        references(:content_import_snapshots, prefix: @prefix, on_delete: :nilify_all)
      )

      add(:actor_id, references(:users, prefix: "account", on_delete: :nilify_all))
      add(:thread, :string, null: false)
      add(:scope_ref, :string)
      add(:status, :string, null: false, default: "pending")
      add(:idempotency_key, :string, null: false)
      add(:preparation_ref, :text)
      add(:preparation_hash, :string)
      add(:preparation_version, :integer)
      add(:plan_ref, :text)
      add(:plan_hash, :string)
      add(:plan_version, :integer)
      add(:plan_summary, :map, null: false, default: %{})
      add(:diff_summary, :map, null: false, default: %{})
      add(:diagnostics, :map, null: false, default: %{"items" => []})
      add(:progress, :map, null: false, default: %{})
      add(:error_code, :string)
      add(:error_message, :text)
      add(:cancelled_at, :timestamptz)
      add(:completed_at, :timestamptz)

      timestamps()
    end

    create(unique_index(:content_import_jobs, [:hash_id], prefix: @prefix))
    create(index(:content_import_jobs, [:connection_id], prefix: @prefix))

    create(index(:content_import_jobs, [:community_id, :status, :inserted_at], prefix: @prefix))

    create(
      unique_index(:content_import_jobs, [:connection_id, :idempotency_key],
        prefix: @prefix,
        name: :content_import_jobs_idempotency_index
      )
    )

    create(
      constraint(:content_import_jobs, :content_import_jobs_thread_check,
        prefix: @prefix,
        check: "thread IN ('doc', 'changelog', 'post')"
      )
    )

    create(
      constraint(:content_import_jobs, :content_import_jobs_status_check,
        prefix: @prefix,
        check:
          "status IN ('pending', 'loading', 'planning', 'staging', 'ready', 'applying', 'completed', 'failed', 'cancelled')"
      )
    )

    create table(:content_import_job_items, prefix: @prefix) do
      add(
        :job_id,
        references(:content_import_jobs, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:external_ref, :text, null: false)
      add(:target_ref, :string)
      add(:action, :string, null: false)
      add(:resolution, :string)
      add(:selected, :boolean, null: false, default: true)
      add(:source_revision, :string)
      add(:source_hash, :string)
      add(:preview, :map, null: false, default: %{})

      timestamps()
    end

    create(
      unique_index(:content_import_job_items, [:job_id, :external_ref],
        prefix: @prefix,
        name: :content_import_job_items_job_source_index
      )
    )

    create(index(:content_import_job_items, [:job_id, :action], prefix: @prefix))
    create(index(:content_import_job_items, [:job_id, :resolution], prefix: @prefix))

    create(
      constraint(:content_import_job_items, :content_import_job_items_action_check,
        prefix: @prefix,
        check: "action IN ('create', 'update', 'skip', 'conflict', 'source_deleted')"
      )
    )

    create(
      constraint(:content_import_job_items, :content_import_job_items_resolution_check,
        prefix: @prefix,
        check:
          "resolution IS NULL OR resolution IN ('source_wins', 'local_wins', 'keep', 'unlink', 'archive', 'manual', 'skip')"
      )
    )

    create table(:content_import_job_assets, prefix: @prefix) do
      add(
        :job_id,
        references(:content_import_jobs, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(:asset_key, :string, null: false)
      add(:source, :map, null: false)
      add(:source_path, :text)
      add(:mime_type, :string)
      add(:content_hash, :string)
      add(:staging_ref, :text)
      add(:source_references, :map, null: false, default: %{"items" => []})
      add(:status, :string, null: false, default: "pending")
      add(:attempts, :integer, null: false, default: 0)
      add(:last_error, :map, null: false, default: %{})
      add(:claimed_at, :timestamptz)
      add(:lease_expires_at, :timestamptz)
      add(:staged_at, :timestamptz)

      timestamps()
    end

    create(
      unique_index(:content_import_job_assets, [:job_id, :asset_key],
        prefix: @prefix,
        name: :content_import_job_assets_job_asset_index
      )
    )

    create(index(:content_import_job_assets, [:job_id, :status], prefix: @prefix))

    create(index(:content_import_job_assets, [:status, :lease_expires_at], prefix: @prefix))

    create(
      constraint(:content_import_job_assets, :content_import_job_assets_status_check,
        prefix: @prefix,
        check: "status IN ('pending', 'staging', 'ready', 'failed', 'cancelled')"
      )
    )

    create table(:content_import_mappings, prefix: @prefix) do
      add(
        :connection_id,
        references(:content_import_connections, prefix: @prefix, on_delete: :delete_all),
        null: false
      )

      add(
        :snapshot_id,
        references(:content_import_snapshots, prefix: @prefix, on_delete: :nilify_all)
      )

      add(:external_ref, :text, null: false)
      add(:thread, :string, null: false)
      add(:target_ref, :string, null: false)
      add(:last_imported_revision, :string)
      add(:last_imported_source_hash, :string, null: false)
      add(:last_imported_local_hash, :string, null: false)
      add(:last_imported_at, :timestamptz, null: false)

      timestamps()
    end

    create(
      unique_index(:content_import_mappings, [:connection_id, :thread, :external_ref],
        prefix: @prefix,
        name: :content_import_mappings_source_index
      )
    )

    create(index(:content_import_mappings, [:thread, :target_ref], prefix: @prefix))

    create(
      constraint(:content_import_mappings, :content_import_mappings_thread_check,
        prefix: @prefix,
        check: "thread IN ('doc', 'changelog', 'post')"
      )
    )
  end
end
