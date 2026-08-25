defmodule GroupherServer.Repo.Migrations.CreateCommunityApplicationsV1 do
  use Ecto.Migration

  @cms_prefix "cms"
  @account_prefix "account"

  def change do
    create table(:community_applications, prefix: @cms_prefix) do
      add(:public_ref, :string, null: false)

      add(:user_id, references(:users, prefix: @account_prefix, on_delete: :delete_all),
        null: false
      )

      add(:community_id, references(:communities, prefix: @cms_prefix, on_delete: :nilify_all))
      add(:status, :string, null: false, default: "submitted")
      add(:version, :integer, null: false, default: 1)

      add(:title, :string, null: false)
      add(:slug, :string, null: false)
      add(:desc, :text, null: false)
      add(:logo_asset_ref, :string, null: false)
      add(:locale, :string, null: false, default: "en")
      add(:apply_category, :string, null: false)
      add(:apply_message, :text)

      add(:idempotency_key, :string, null: false)
      add(:input_fingerprint, :string, null: false)
      add(:policy_snapshot, :map, null: false, default: %{})
      add(:review_metadata, :map, null: false, default: %{})

      add(:submitted_at, :timestamptz, null: false)
      add(:expires_at, :timestamptz)
      add(:reviewed_at, :timestamptz)
      add(:setup_started_at, :timestamptz)
      add(:completed_at, :timestamptz)
      add(:cancelled_at, :timestamptz)
      add(:expired_at, :timestamptz)
      add(:last_job_error, :map)

      add(:reviewer_id, references(:users, prefix: @account_prefix, on_delete: :nilify_all))
      add(:decision_reason_code, :string)
      add(:decision_note, :text)

      timestamps()
    end

    create(unique_index(:community_applications, [:public_ref], prefix: @cms_prefix))

    create(
      unique_index(:community_applications, [:user_id, :idempotency_key],
        prefix: @cms_prefix,
        name: :community_applications_user_idempotency_index
      )
    )

    create(
      unique_index(:community_applications, [:user_id],
        prefix: @cms_prefix,
        where: "status IN ('submitted', 'reviewing', 'approved', 'setting_up')",
        name: :community_applications_one_blocking_per_user_index
      )
    )

    create(index(:community_applications, [:status, :submitted_at], prefix: @cms_prefix))
    create(index(:community_applications, [:user_id, :updated_at], prefix: @cms_prefix))

    create(
      constraint(:community_applications, :community_applications_status_check,
        prefix: @cms_prefix,
        check:
          "status IN ('submitted', 'reviewing', 'approved', 'creation_failed', 'setting_up', 'setup_failed', 'created', 'rejected', 'cancelled', 'expired')"
      )
    )

    create table(:community_application_events, prefix: @cms_prefix) do
      add(
        :application_id,
        references(:community_applications, prefix: @cms_prefix, on_delete: :delete_all),
        null: false
      )

      add(:from_status, :string)
      add(:to_status, :string, null: false)
      add(:actor_type, :string, null: false)
      add(:actor_id, references(:users, prefix: @account_prefix, on_delete: :nilify_all))
      add(:reason_code, :string)
      add(:operation_ref, :string)
      add(:metadata, :map, null: false, default: %{})
      add(:occurred_at, :timestamptz, null: false)

      timestamps(updated_at: false)
    end

    create(
      index(:community_application_events, [:application_id, :occurred_at, :id],
        prefix: @cms_prefix,
        name: :community_application_events_timeline_index
      )
    )

    create(
      constraint(:community_application_events, :community_application_events_actor_type_check,
        prefix: @cms_prefix,
        check: "actor_type IN ('applicant', 'reviewer', 'job', 'system')"
      )
    )

    create table(:community_application_logo_uploads, prefix: @cms_prefix) do
      add(:public_ref, :string, null: false)

      add(:user_id, references(:users, prefix: @account_prefix, on_delete: :delete_all),
        null: false
      )

      add(
        :application_id,
        references(:community_applications, prefix: @cms_prefix, on_delete: :nilify_all)
      )

      add(:storage, :string)
      add(:storage_key, :string)
      add(:url, :text)
      add(:content_hash, :string)
      add(:filename, :string, null: false)
      add(:mime_type, :string, null: false)
      add(:size_bytes, :bigint, null: false)
      add(:status, :string, null: false, default: "pending")
      add(:expires_at, :timestamptz, null: false)

      add(
        :community_asset_id,
        references(:community_assets, prefix: @cms_prefix, on_delete: :nilify_all)
      )

      add(:finalized_at, :timestamptz)
      add(:promoted_at, :timestamptz)

      timestamps()
    end

    create(unique_index(:community_application_logo_uploads, [:public_ref], prefix: @cms_prefix))

    create(
      index(:community_application_logo_uploads, [:status, :expires_at], prefix: @cms_prefix)
    )

    create(
      constraint(
        :community_application_logo_uploads,
        :community_application_logo_uploads_status_check,
        prefix: @cms_prefix,
        check: "status IN ('pending', 'finalized', 'promoted', 'expired')"
      )
    )

    create table(:community_slug_claims, prefix: @cms_prefix) do
      add(:slug, :string, null: false)
      add(:status, :string, null: false)

      add(
        :application_id,
        references(:community_applications, prefix: @cms_prefix, on_delete: :nilify_all)
      )

      add(:community_id, references(:communities, prefix: @cms_prefix, on_delete: :nilify_all))

      add(
        :claimed_by_user_id,
        references(:users, prefix: @account_prefix, on_delete: :nilify_all),
        null: false
      )

      add(:claim_reason, :string, null: false)
      add(:expires_at, :timestamptz)
      add(:released_at, :timestamptz)
      add(:cooldown_until, :timestamptz)

      timestamps()
    end

    create(
      unique_index(:community_slug_claims, [:slug],
        prefix: @cms_prefix,
        where: "released_at IS NULL AND status IN ('application', 'community', 'reserved')",
        name: :community_slug_claims_active_slug_index
      )
    )

    create(index(:community_slug_claims, [:application_id], prefix: @cms_prefix))
    create(index(:community_slug_claims, [:community_id], prefix: @cms_prefix))
    create(index(:community_slug_claims, [:expires_at], prefix: @cms_prefix))

    create table(:community_lifecycles, prefix: @cms_prefix) do
      add(:community_id, references(:communities, prefix: @cms_prefix, on_delete: :delete_all),
        null: false
      )

      add(
        :application_id,
        references(:community_applications, prefix: @cms_prefix, on_delete: :nilify_all),
        null: false
      )

      add(:state, :string, null: false, default: "setting_up")
      add(:version, :integer, null: false, default: 1)
      add(:activated_at, :timestamptz)
      add(:failed_at, :timestamptz)
      add(:last_error, :map)

      timestamps()
    end

    create(unique_index(:community_lifecycles, [:community_id], prefix: @cms_prefix))
    create(unique_index(:community_lifecycles, [:application_id], prefix: @cms_prefix))

    create(
      constraint(:community_lifecycles, :community_lifecycles_state_check,
        prefix: @cms_prefix,
        check: "state IN ('setting_up', 'active', 'setup_failed')"
      )
    )
  end
end
