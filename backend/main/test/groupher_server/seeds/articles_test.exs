defmodule GroupherServer.Test.Seeds.ArticlesTest do
  @moduledoc false
  use GroupherServer.TestMate
  @moduletag timeout: 300_000

  alias GroupherServer.CMS.Seeds.{Articles, Communities}

  describe "[articles seeds]" do
    test "mock seeds articles with comments and reactions" do
      slug = "seed-articles-#{System.unique_integer([:positive, :monotonic])}"
      {:ok, community} = Communities.mock(slug)

      {:ok, articles} =
        Articles.mock(community, :post, count_range: {2, 2}, comment_range: {2, 2})

      assert length(articles) == 2

      [first | _] = articles
      {:ok, reloaded_post} = ORM.find(Post, first.id)

      comments_count =
        from(c in Comment, where: c.post_id == ^first.id)
        |> count()

      assert comments_count >= 2
      assert reloaded_post.upvotes_count > 0

      emotion_total =
        reloaded_post.emotions
        |> Map.from_struct()
        |> Enum.filter(fn {k, _v} -> String.ends_with?(Atom.to_string(k), "_count") end)
        |> Enum.map(fn {_k, v} -> v end)
        |> Enum.sum()

      assert emotion_total > 0
    end
  end

  defp count(queryable) do
    {:ok, total_count} = ORM.count(queryable)
    total_count
  end
end
