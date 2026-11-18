defmodule GroupherServer.Repo.Migrations.CreateCommunityAdminRequests do
  use Ecto.Migration

  @prefix "cms"

  def up do
    create table(:community_admin_requests, prefix: @prefix, primary_key: false) do
      add(:id, :uuid, primary_key: true)

      add(:community_id, references(:communities, prefix: @prefix, on_delete: :restrict),
        null: false
      )

      add(:subject_user_id, references(:users, prefix: "account", on_delete: :restrict),
        null: false
      )

      add(:created_by_id, references(:users, prefix: "account", on_delete: :restrict),
        null: false
      )

      add(:type, :text, null: false)
      add(:status, :text, null: false, default: "pending")
      add(:decision, :text)
      add(:proposed_permissions, :map, null: false)
      add(:approved_permissions, :map)
      add(:revision, :bigint, null: false, default: 1)
      add(:decided_by_id, references(:users, prefix: "account", on_delete: :restrict))
      add(:decided_at, :timestamptz)
      add(:cancelled_by_id, references(:users, prefix: "account", on_delete: :restrict))
      add(:cancelled_at, :timestamptz)
      add(:expires_at, :timestamptz, null: false)
      add(:reason, :text)
      timestamps()
    end

    create(
      unique_index(:community_admin_requests, [:community_id, :subject_user_id],
        prefix: @prefix,
        where: "status = 'pending'",
        name: :community_admin_requests_pending_index
      )
    )

    create(
      index(:community_admin_requests, [:community_id, :status, :inserted_at, :id],
        prefix: @prefix
      )
    )

    create(
      index(:community_admin_requests, [:subject_user_id, :status, :inserted_at, :id],
        prefix: @prefix
      )
    )

    create(
      index(:community_admin_requests, [:expires_at, :id],
        prefix: @prefix,
        where: "status = 'pending'",
        name: :community_admin_requests_expiry_index
      )
    )

    create(
      constraint(:community_admin_requests, :community_admin_requests_type_check,
        prefix: @prefix,
        check: "type IN ('invite', 'apply')"
      )
    )

    create(
      constraint(:community_admin_requests, :community_admin_requests_status_check,
        prefix: @prefix,
        check: "status IN ('pending', 'decided', 'cancelled', 'expired')"
      )
    )

    create(
      constraint(:community_admin_requests, :community_admin_requests_revision_check,
        prefix: @prefix,
        check: "revision > 0"
      )
    )

    create(
      constraint(:community_admin_requests, :community_admin_requests_state_check,
        prefix: @prefix,
        check:
          "(status = 'decided' AND decision IS NOT NULL AND decision IN ('accept', 'reject') AND decided_by_id IS NOT NULL AND decided_at IS NOT NULL AND ((decision = 'accept' AND approved_permissions IS NOT NULL) OR (decision = 'reject' AND approved_permissions IS NULL)) AND cancelled_by_id IS NULL AND cancelled_at IS NULL) OR (status = 'cancelled' AND decision IS NULL AND decided_by_id IS NULL AND decided_at IS NULL AND approved_permissions IS NULL AND cancelled_by_id IS NOT NULL AND cancelled_at IS NOT NULL) OR (status IN ('pending', 'expired') AND decision IS NULL AND decided_by_id IS NULL AND decided_at IS NULL AND approved_permissions IS NULL AND cancelled_by_id IS NULL AND cancelled_at IS NULL)"
      )
    )

    execute("""
    CREATE FUNCTION cms.guard_community_admin_proposal() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.proposed_permissions IS DISTINCT FROM OLD.proposed_permissions THEN
        RAISE EXCEPTION 'Admin proposal is immutable' USING ERRCODE='23514', CONSTRAINT='community_admin_proposal_immutable';
      END IF;
      RETURN NEW;
    END $$
    """)

    execute("""
    CREATE TRIGGER community_admin_proposal_guard BEFORE UPDATE OF proposed_permissions
    ON cms.community_admin_requests FOR EACH ROW EXECUTE FUNCTION cms.guard_community_admin_proposal()
    """)
  end

  def down do
    execute("DROP TRIGGER community_admin_proposal_guard ON cms.community_admin_requests")
    execute("DROP FUNCTION cms.guard_community_admin_proposal()")
    drop(table(:community_admin_requests, prefix: @prefix))
  end
end
