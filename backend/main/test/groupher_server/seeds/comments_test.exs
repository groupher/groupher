defmodule GroupherServer.Test.Seeds.CommentsTest do
  @moduledoc false
  use GroupherServer.TestTools

  alias GroupherServer.CMS.Seeds.{Comments, Communities}

  describe "[comments seeds]" do
    test "mock seeds comments with upvotes and emotions" do
      slug = "seed-comments-#{System.unique_integer([:positive, :monotonic])}"
      {:ok, community} = Communities.mock(slug)

      {:ok, author} = db_insert(:user)
      attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, article} = CMS.Articles.create(community, :post, attrs, author)

      {:ok, comments} = Comments.mock(community, :post, article, count_range: {3, 3})

      assert length(comments) == 3

      [first | _] = comments
      {:ok, first} = ORM.find(Comment, first.id)

      assert first.upvotes_count > 0

      emotion_total =
        first.emotions
        |> Map.from_struct()
        |> Enum.filter(fn {k, _v} -> String.ends_with?(Atom.to_string(k), "_count") end)
        |> Enum.map(fn {_k, v} -> v end)
        |> Enum.sum()

      assert emotion_total > 0
    end
  end
end
