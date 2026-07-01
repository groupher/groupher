defmodule GroupherServer.Repo.Migrations.RepairDocsDocIdStageIndex do
  use Ecto.Migration

  @prefix "cms"

  def up do
    # The doc_id identifies one logical doc across draft/public rows. The old
    # single-column unique index blocks creating a draft beside its public doc.
    execute("DROP INDEX IF EXISTS #{@prefix}.docs_doc_id_index;")

    create_if_not_exists(
      unique_index(:docs, [:community_id, :stage, :doc_id],
        prefix: @prefix,
        where: "doc_id IS NOT NULL",
        name: :docs_community_stage_doc_id_index
      )
    )
  end

  def down do
    execute("DROP INDEX IF EXISTS #{@prefix}.docs_community_stage_doc_id_index;")

    create_if_not_exists(
      unique_index(:docs, [:doc_id],
        prefix: @prefix,
        where: "doc_id IS NOT NULL",
        name: :docs_doc_id_index
      )
    )
  end
end
