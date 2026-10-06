defmodule GroupherServer.Repo.Migrations.CutoverDocReleaseBranchVersions do
  @moduledoc "Moves Docs release membership from legacy snapshots to branch versions."

  use Ecto.Migration

  @prefix "cms"

  @doc "Adds the immutable branch-version release coordinate."
  def change do
    alter table(:doc_publish_release_articles, prefix: @prefix) do
      modify(:snapshot_id, :bigint, null: true, from: {:bigint, null: false})

      add(
        :branch_version_id,
        references(:doc_branch_versions, prefix: @prefix, on_delete: :delete_all)
      )
    end

    create(
      index(:doc_publish_release_articles, [:branch_version_id],
        prefix: @prefix,
        name: :doc_publish_release_articles_branch_version_id_index
      )
    )
  end
end
