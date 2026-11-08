defmodule GroupherServer.Test.CMS.MentionsGraphQueryPlanTest do
  @moduledoc "Checks the bounded current-edge lookup used by graph pagination."
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.Mentions.Endpoint

  test "source edge window uses its pagination index" do
    {_community, article, _attrs, _user} = mock_article(:post)
    source = Repo.get_by!(Endpoint, type: :post, article_id: article.article_id)

    plan =
      Repo.transaction(fn ->
        Repo.query!("SET LOCAL enable_seqscan = off")

        Repo.query!(
          "EXPLAIN SELECT id FROM cms.mention_current_edges " <>
            "WHERE source_endpoint_id = $1 ORDER BY edge_key LIMIT 20",
          [Ecto.UUID.dump!(source.id)]
        ).rows
      end)

    assert {:ok, rows} = plan

    assert Enum.any?(rows, fn [line] ->
             String.contains?(line, "mention_current_edge_source_window_index")
           end)
  end
end
