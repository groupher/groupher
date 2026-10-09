defmodule GroupherServer.Test.Accounts.ReactedContents do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.Accounts
  alias Accounts.Upvotes, as: Accounts

  setup do
    {community, post, _attrs, user} = mock_article(:post)

    {:ok, ~m(community user post)a}
  end

  describe "[user upvoted articles]" do
    test "user can get paged upvoted common articles", ~m(community user post)a do
      {:ok, _} = CMS.Interactions.upvote(post, user, Ecto.UUID.generate())

      filter = %{page: 1, size: 20}
      {:ok, articles} = Accounts.paged_articles(user, filter)

      article_post = articles |> Map.get(:entries) |> List.last()

      assert articles |> is_valid_pagination?(:raw)
      assert post.id == article_post |> Map.get(:id)
      assert article_inner_id(post, community) == article_post |> Map.get(:inner_id)

      assert [:author, :id, :inner_id, :thread, :title, :upvotes_count] |> Enum.sort() ==
               article_post |> Map.keys() |> Enum.sort()
    end

    test "user can get paged upvoted posts by thread filter", ~m(user post)a do
      {:ok, _} = CMS.Interactions.upvote(post, user, Ecto.UUID.generate())

      filter = %{thread: :post, page: 1, size: 20}
      {:ok, articles} = Accounts.paged_articles(user, filter)

      assert articles |> is_valid_pagination?(:raw)
      assert post.id == articles |> Map.get(:entries) |> List.last() |> Map.get(:id)
      assert 1 == articles |> Map.get(:total_count)
    end

    test "invalid thread filter returns explicit error", ~m(user post)a do
      {:ok, _} = CMS.Interactions.upvote(post, user, Ecto.UUID.generate())

      filter = %{thread: "INVALID", page: 1, size: 20}

      assert {:error, %ErrorCat.Error{reason: :custom, details: "invalid thread"}} =
               Accounts.paged_articles(user, filter)
    end
  end
end
