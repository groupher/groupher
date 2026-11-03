defmodule GroupherServer.CMS.ArtimentMentions.ReferenceMap.PageFacts do
  @moduledoc """
  Reads bounded raw directed facts for each frontier in indexed edge-key windows.

      frontier cursor -> per-direction top-N index scans -> public projection
  """

  alias GroupherServer.CMS.ArtimentMentions.ReferenceMap.ReadModel
  alias GroupherServer.Repo

  @scan_window 40

  @doc "Reads a bounded raw edge-key window for each requested frontier."
  def raw_window(frontiers) do
    if frontiers == [] do
      []
    else
      sql = """
      WITH frontiers AS (
        SELECT * FROM jsonb_to_recordset($1::jsonb)
          AS input(request_index int, type text, article_id uuid,
                   comment_id bigint, branch_id bigint, after_key text)
      )
      SELECT input.request_index, candidate.id, candidate.edge_key
      FROM frontiers input
      CROSS JOIN LATERAL (
        SELECT id, edge_key FROM (
          (SELECT m.id, m.edge_key FROM cms.artiment_mentions m
           WHERE input.article_id IS NOT NULL AND m.mentioned_scope = 'internal'
             AND m.mentioner_type = input.type
             AND m.mentioner_article_id = input.article_id
             AND m.mentioner_branch_id IS NOT DISTINCT FROM input.branch_id
             AND (input.after_key IS NULL OR m.edge_key > input.after_key)
           ORDER BY m.edge_key LIMIT $2)
          UNION
          (SELECT m.id, m.edge_key FROM cms.artiment_mentions m
           WHERE input.comment_id IS NOT NULL AND m.mentioned_scope = 'internal'
             AND m.mentioner_type = 'comment'
             AND m.mentioner_comment_id = input.comment_id
             AND m.mentioner_branch_id IS NOT DISTINCT FROM input.branch_id
             AND (input.after_key IS NULL OR m.edge_key > input.after_key)
           ORDER BY m.edge_key LIMIT $2)
          UNION
          (SELECT m.id, m.edge_key FROM cms.artiment_mentions m
           WHERE input.article_id IS NOT NULL AND m.mentioned_scope = 'internal'
             AND m.mentioned_type = input.type
             AND m.mentioned_article_id = input.article_id
             AND m.mentioned_branch_id IS NOT DISTINCT FROM input.branch_id
             AND (input.after_key IS NULL OR m.edge_key > input.after_key)
           ORDER BY m.edge_key LIMIT $2)
          UNION
          (SELECT m.id, m.edge_key FROM cms.artiment_mentions m
           WHERE input.comment_id IS NOT NULL AND m.mentioned_scope = 'internal'
             AND m.mentioned_type = 'comment'
             AND m.mentioned_comment_id = input.comment_id
             AND m.mentioned_branch_id IS NOT DISTINCT FROM input.branch_id
             AND (input.after_key IS NULL OR m.edge_key > input.after_key)
           ORDER BY m.edge_key LIMIT $2)
        ) candidates
        ORDER BY edge_key LIMIT $2
      ) candidate
      ORDER BY input.request_index, candidate.edge_key
      """

      rows = Repo.query!(sql, [encode_frontiers(frontiers), @scan_window]).rows

      facts =
        rows
        |> Enum.map(&Enum.at(&1, 1))
        |> Enum.uniq()
        |> ReadModel.facts_by_ids()
        |> Map.new(&{&1.id, &1})

      Enum.map(rows, fn [index, id, key] -> {index, Map.fetch!(facts, id), key} end)
    end
  end

  defp encode_frontiers(frontiers) do
    frontiers
    |> Enum.map(fn {index, node, after_key} ->
      node.key
      |> key_map()
      |> Map.put(:request_index, index)
      |> Map.put(:after_key, after_key)
    end)
  end

  defp key_map({type, article_id, comment_id, branch_id}) do
    %{type: type, article_id: article_id, comment_id: comment_id, branch_id: branch_id}
  end
end
