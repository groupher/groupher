defmodule GroupherServer.Repo.Migrations.DropDocsPublishedSlugIndex do
  use Ecto.Migration

  @prefix "cms"

  def up do
    execute("DROP INDEX IF EXISTS #{@prefix}.docs_published_slug_idx;")
    execute("DROP INDEX IF EXISTS #{@prefix}.docs_slug_index;")
  end

  def down do
    create_if_not_exists(
      unique_index(:docs, [:community_id, :slug],
        prefix: @prefix,
        where: "stage = 'public' AND slug IS NOT NULL",
        name: :docs_published_slug_idx
      )
    )
  end
end
