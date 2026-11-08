defmodule GroupherServer.Repo.Migrations.IndexMentionCurrentEdgesByEndpointAndKey do
  @moduledoc "Adds ordered adjacency indexes for both directions of the Mention graph."

  use Ecto.Migration

  @prefix "cms"

  def up do
    create(
      index(:mention_current_edges, [:source_endpoint_id, :edge_key],
        prefix: @prefix,
        name: :mention_current_edge_source_window_index
      )
    )

    create(
      index(:mention_current_edges, [:target_endpoint_id, :edge_key],
        prefix: @prefix,
        where: "target_endpoint_id IS NOT NULL",
        name: :mention_current_edge_target_window_index
      )
    )
  end

  def down do
    drop(
      index(:mention_current_edges, [:target_endpoint_id, :edge_key],
        prefix: @prefix,
        name: :mention_current_edge_target_window_index
      )
    )

    drop(
      index(:mention_current_edges, [:source_endpoint_id, :edge_key],
        prefix: @prefix,
        name: :mention_current_edge_source_window_index
      )
    )
  end
end
