defmodule GroupherServer.Repo.Migrations.CreateArticleCoAuthors do
  use Ecto.Migration
  @prefix "cms"

  def up do
    create table(:article_co_authors, prefix: @prefix, primary_key: false) do
      add(:id, :uuid, primary_key: true)

      add(:article_id, references(:articles, prefix: @prefix, type: :uuid, on_delete: :restrict),
        null: false
      )

      add(:author_id, references(:authors, prefix: @prefix, on_delete: :restrict), null: false)
      add(:permissions, :map, null: false, default: %{})
      add(:revision, :bigint, null: false, default: 1)
      add(:joined_at, :timestamptz, null: false)
      timestamps()
    end

    create(unique_index(:article_co_authors, [:article_id, :author_id], prefix: @prefix))
    create(index(:article_co_authors, [:author_id, :article_id], prefix: @prefix))

    create(
      constraint(:article_co_authors, :article_co_authors_revision_check,
        prefix: @prefix,
        check: "revision > 0"
      )
    )

    execute("""
    CREATE FUNCTION cms.guard_article_co_author_owner() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE owner_id bigint;
    BEGIN
      SELECT author_id INTO owner_id FROM cms.articles WHERE id = NEW.article_id FOR UPDATE;
      IF owner_id = NEW.author_id THEN
        RAISE EXCEPTION 'Article owner cannot be a co-author' USING ERRCODE='23514', CONSTRAINT='article_co_authors_owner_check';
      END IF;
      RETURN NEW;
    END $$
    """)

    execute("""
    CREATE TRIGGER article_co_authors_owner_guard BEFORE INSERT OR UPDATE OF article_id, author_id
    ON cms.article_co_authors FOR EACH ROW EXECUTE FUNCTION cms.guard_article_co_author_owner()
    """)

    execute("""
    CREATE FUNCTION cms.guard_article_owner_membership() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM cms.article_co_authors WHERE article_id = NEW.id AND author_id = NEW.author_id) THEN
        RAISE EXCEPTION 'Article owner cannot be a co-author' USING ERRCODE='23514', CONSTRAINT='article_co_authors_owner_check';
      END IF;
      RETURN NEW;
    END $$
    """)

    execute("""
    CREATE TRIGGER article_owner_membership_guard BEFORE UPDATE OF author_id ON cms.articles
    FOR EACH ROW EXECUTE FUNCTION cms.guard_article_owner_membership()
    """)

    create table(:article_co_author_requests, prefix: @prefix, primary_key: false) do
      add(:id, :uuid, primary_key: true)

      add(:article_id, references(:articles, prefix: @prefix, type: :uuid, on_delete: :restrict),
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
      unique_index(:article_co_author_requests, [:article_id, :subject_user_id],
        prefix: @prefix,
        where: "status = 'pending'",
        name: :article_co_author_requests_pending_index
      )
    )

    create(index(:article_co_author_requests, [:article_id, :inserted_at, :id], prefix: @prefix))

    create(
      index(:article_co_author_requests, [:subject_user_id, :status, :inserted_at, :id],
        prefix: @prefix,
        name: :article_co_author_requests_subject_index
      )
    )

    create(
      index(:article_co_author_requests, [:expires_at, :id],
        prefix: @prefix,
        where: "status = 'pending'",
        name: :article_co_author_requests_expiry_index
      )
    )

    create(
      constraint(:article_co_author_requests, :article_co_author_requests_type_check,
        prefix: @prefix,
        check: "type IN ('invite', 'apply')"
      )
    )

    create(
      constraint(:article_co_author_requests, :article_co_author_requests_revision_check,
        prefix: @prefix,
        check: "revision > 0"
      )
    )

    create(
      constraint(:article_co_author_requests, :article_co_author_requests_status_check,
        prefix: @prefix,
        check: "status IN ('pending', 'decided', 'cancelled', 'expired')"
      )
    )

    create(
      constraint(:article_co_author_requests, :article_co_author_requests_state_check,
        prefix: @prefix,
        check:
          "(status = 'decided' AND decision IS NOT NULL AND decision IN ('accept', 'reject') AND decided_by_id IS NOT NULL AND decided_at IS NOT NULL AND ((decision = 'accept' AND approved_permissions IS NOT NULL) OR (decision = 'reject' AND approved_permissions IS NULL)) AND cancelled_by_id IS NULL AND cancelled_at IS NULL) OR (status = 'cancelled' AND decision IS NULL AND decided_by_id IS NULL AND decided_at IS NULL AND approved_permissions IS NULL AND cancelled_by_id IS NOT NULL AND cancelled_at IS NOT NULL) OR (status IN ('pending', 'expired') AND decision IS NULL AND decided_by_id IS NULL AND decided_at IS NULL AND approved_permissions IS NULL AND cancelled_by_id IS NULL AND cancelled_at IS NULL)"
      )
    )

    execute("""
    CREATE FUNCTION cms.guard_co_author_proposal() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.proposed_permissions IS DISTINCT FROM OLD.proposed_permissions THEN
        RAISE EXCEPTION 'Co-author proposal is immutable' USING ERRCODE='23514', CONSTRAINT='article_co_author_proposal_immutable';
      END IF;
      RETURN NEW;
    END $$
    """)

    execute("""
    CREATE TRIGGER article_co_author_proposal_guard BEFORE UPDATE OF proposed_permissions
    ON cms.article_co_author_requests FOR EACH ROW EXECUTE FUNCTION cms.guard_co_author_proposal()
    """)
  end

  def down do
    execute("DROP TRIGGER article_co_author_proposal_guard ON cms.article_co_author_requests")
    execute("DROP FUNCTION cms.guard_co_author_proposal()")
    drop(table(:article_co_author_requests, prefix: @prefix))
    execute("DROP TRIGGER article_owner_membership_guard ON cms.articles")
    execute("DROP FUNCTION cms.guard_article_owner_membership()")
    execute("DROP TRIGGER article_co_authors_owner_guard ON cms.article_co_authors")
    execute("DROP FUNCTION cms.guard_article_co_author_owner()")
    drop(table(:article_co_authors, prefix: @prefix))
  end
end
