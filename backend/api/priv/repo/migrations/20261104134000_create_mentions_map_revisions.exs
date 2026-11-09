defmodule GroupherServer.Repo.Migrations.CreateMentionsMapRevisions do
  @moduledoc "Creates the single global Mentions Map query revision row."

  use Ecto.Migration

  @prefix "cms"

  def up do
    create table(:mentions_map_revisions, primary_key: false, prefix: @prefix) do
      add(:id, :integer, primary_key: true)
      add(:revision, :bigint, null: false, default: 0)
    end

    create(
      constraint(:mentions_map_revisions, :mentions_map_revision_singleton_check,
        prefix: @prefix,
        check: "id = 1 AND revision >= 0"
      )
    )

    execute("INSERT INTO cms.mentions_map_revisions (id, revision) VALUES (1, 0)")
  end

  def down do
    drop_if_exists(table(:mentions_map_revisions, prefix: @prefix))
  end
end
