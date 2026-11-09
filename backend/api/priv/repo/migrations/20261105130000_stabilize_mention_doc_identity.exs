defmodule GroupherServer.Repo.Migrations.StabilizeMentionDocIdentity do
  @moduledoc "Removes branch identity from the isolated, empty Mention fact schema."
  use Ecto.Migration

  def up do
    # B1 uses an empty facts dataset. Never merge or reinterpret existing endpoints.
    execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM cms.mention_endpoints) THEN
        RAISE EXCEPTION 'Stable Mention identity requires an empty isolated facts dataset';
      END IF;
    END $$;
    """)

    drop(constraint(:mention_endpoints, :mention_endpoint_identity_check, prefix: "cms"))

    drop(
      index(:mention_endpoints, [:article_id, :branch_id],
        prefix: "cms",
        name: :mention_endpoint_doc_identity_index
      )
    )

    drop(
      index(:mention_endpoints, [:type, :article_id],
        prefix: "cms",
        name: :mention_endpoint_article_identity_index
      )
    )

    alter table(:mention_endpoints, prefix: "cms") do
      remove(:branch_id)
    end

    create(
      constraint(:mention_endpoints, :mention_endpoint_identity_check,
        prefix: "cms",
        check:
          "(type IN ('post','blog','changelog','doc','ticket') AND article_id IS NOT NULL " <>
            "AND comment_id IS NULL AND parent_endpoint_id IS NULL) OR " <>
            "(type = 'comment' AND article_id IS NULL AND comment_id IS NOT NULL " <>
            "AND parent_endpoint_id IS NOT NULL)"
      )
    )

    create(
      unique_index(:mention_endpoints, [:type, :article_id],
        prefix: "cms",
        where: "article_id IS NOT NULL",
        name: :mention_endpoint_article_identity_index
      )
    )
  end

  def down do
    raise "Restore the pre-cutover snapshot; stable Mention identities have no branch rollback"
  end
end
