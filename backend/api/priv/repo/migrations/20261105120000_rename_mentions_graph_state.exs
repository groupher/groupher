defmodule GroupherServer.Repo.Migrations.RenameMentionsGraphState do
  @moduledoc "Renames the single global Mentions graph revision row."

  use Ecto.Migration

  @prefix "cms"

  def up do
    rename(
      table(:mentions_map_revisions, prefix: @prefix),
      to: table(:mentions_graph_state, prefix: @prefix)
    )

    execute(
      "ALTER TABLE cms.mentions_graph_state RENAME CONSTRAINT mentions_map_revision_singleton_check TO mentions_graph_state_singleton_check"
    )

    execute(
      "ALTER TABLE cms.mentions_graph_state RENAME CONSTRAINT mentions_map_revisions_pkey TO mentions_graph_state_pkey"
    )
  end

  def down do
    execute(
      "ALTER TABLE cms.mentions_graph_state RENAME CONSTRAINT mentions_graph_state_pkey TO mentions_map_revisions_pkey"
    )

    execute(
      "ALTER TABLE cms.mentions_graph_state RENAME CONSTRAINT mentions_graph_state_singleton_check TO mentions_map_revision_singleton_check"
    )

    rename(
      table(:mentions_graph_state, prefix: @prefix),
      to: table(:mentions_map_revisions, prefix: @prefix)
    )
  end
end
