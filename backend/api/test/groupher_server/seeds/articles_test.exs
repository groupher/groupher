defmodule GroupherServer.Test.Seeds.ArticlesTest do
  @moduledoc false
  use GroupherServer.TestMate
  @moduletag timeout: 300_000

  alias GroupherServer.CMS
  alias CMS.Seeds.{Articles, Communities}

  describe "[articles seeds]" do
    test "mock seeds articles with comments and reactions" do
      slug = "seed-articles-#{System.unique_integer([:positive, :monotonic])}"
      {:ok, community} = Communities.mock(slug)

      {:ok, articles} =
        Articles.mock(community, :post, count_range: {2, 2}, comment_range: {2, 2})

      assert length(articles) == 2

      [first | _] = articles
      counts = CMS.Interactions.counts([first]) |> Map.fetch!({:post, first.id})
      {:ok, public_stats} = CMS.ArticleStats.fetch(:post, first.id)

      comments_count =
        from(c in Comment, where: c.post_id == ^first.id)
        |> count()

      assert comments_count >= 2
      assert counts.upvotes_count > 0
      assert [%{type: emotion, count: 1}] = counts.emotion_counts
      assert [%{type: ^emotion, count: 1}] = public_stats.emotion_counts
      refute emotion in [:upvote, :collect]
    end
  end

  defp count(queryable) do
    {:ok, total_count} = ORM.count(queryable)
    total_count
  end
end
