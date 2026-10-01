defmodule GroupherServer.Repo.Migrations.DropDocReleaseSnapshotReference do
  @moduledoc "Removes the superseded DocSnapshot foreign key from release membership."

  use Ecto.Migration

  @prefix "cms"

  @doc "Drops the legacy snapshot coordinate after branch-version cutover."
  def change do
    alter table(:doc_publish_release_articles, prefix: @prefix) do
      remove(:snapshot_id, :bigint)
    end
  end
end
