defmodule GroupherServer.Repo.Migrations.LimitMentionExternalUrlBytes do
  @moduledoc "Bounds URL values stored in indexed Mention projections."

  use Ecto.Migration

  @prefix "cms"

  def change do
    create(
      constraint(:mention_occurrences, :mention_occurrence_url_size_check,
        prefix: @prefix,
        check: "target_type != 'url' OR octet_length(normalized_url) <= 1200"
      )
    )

    create(
      constraint(:mention_current_edges, :mention_current_edge_url_size_check,
        prefix: @prefix,
        check: "target_type != 'url' OR octet_length(normalized_url) <= 1200"
      )
    )
  end
end
