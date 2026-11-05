defmodule GroupherServer.Test.CMS.Comments.SchemaGenerationTest do
  use GroupherServer.TestMate, async: false
  alias GroupherServer.{CMS, Repo}
  alias CMS.Comments.SchemaGeneration

  test "REL-01 schema defaults alone cannot attest freshness or admit an unrecorded database" do
    database = GroupherServer.Release.database_identity!(Repo)

    opts = [
      database: database,
      generation: Ecto.UUID.generate(),
      schema_sha256: SchemaGeneration.schema_fingerprint!(Repo)
    ]

    assert_raise RuntimeError, ~r/provenance is missing/, fn ->
      SchemaGeneration.verify_ready!(Repo, opts)
    end

    assert_raise RuntimeError, ~r/empty database/, fn ->
      SchemaGeneration.bootstrap!(Repo, database, opts[:generation], "test", "test-build")
    end

    assert_raise RuntimeError, ~r/database identity mismatch/, fn ->
      SchemaGeneration.bootstrap!(Repo, "other_database", opts[:generation], "test", "test-build")
    end
  end

  test "REL-01 target fingerprint detects removal of a required identity guard" do
    original = SchemaGeneration.schema_fingerprint!(Repo)
    Repo.query!("DROP TRIGGER guard_doc_membership_owner ON cms.doc_drafts", [])
    refute SchemaGeneration.schema_fingerprint!(Repo) == original
  end

  test "REL-01 physical account deletion guards must be present and ALWAYS enabled" do
    for trigger <- ["block_users_physical_delete", "block_users_truncate"],
        mode <- ["DISABLE", "ENABLE"] do
      try do
        Repo.query!("ALTER TABLE account.users #{mode} TRIGGER #{trigger}", [])

        assert_raise RuntimeError, ~r/physical account deletion guards/, fn ->
          SchemaGeneration.schema_fingerprint!(Repo)
        end
      after
        Repo.query!("ALTER TABLE account.users ENABLE ALWAYS TRIGGER #{trigger}", [])
      end
    end
  end

  test "REL-01 the physical account guard body belongs to the approved schema fingerprint" do
    original = SchemaGeneration.schema_fingerprint!(Repo)

    Repo.query!(
      """
      CREATE OR REPLACE FUNCTION account.guard_users_physical_deletion() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RETURN OLD; END; $$;
      """,
      []
    )

    refute SchemaGeneration.schema_fingerprint!(Repo) == original
  end
end
