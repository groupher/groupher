defmodule GroupherServer.Test.CMS.Comments.FetcherTest do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, post, _, user} = mock_article(:post, preload: [author: :user])
    {:ok, ~m(community post user)a}
  end

  describe "[comment fetcher]" do
    test "fetch_comment returns comment", ~m(community post user)a do
      {:ok, comment} =
        CMS.create_comment(community, :post, post.inner_id, mock_comment(), user)

      assert {:ok, fetched} = CMS.fetch_comment(comment.id)
      assert fetched.id == comment.id
    end

    test "fetch_comment returns not_exist tuple on missing comment" do
      assert {:error, {:not_exist, reason}} = CMS.fetch_comment(9_999_999)
      assert is_binary(reason)
    end

    test "fetch_full_comment returns article info", ~m(community post user)a do
      {:ok, comment} =
        CMS.create_comment(community, :post, post.inner_id, mock_comment(), user)

      assert {:ok, info} = CMS.fetch_full_comment(comment.id)
      assert info.thread == :post
      assert info.article.id == post.id
      assert info.author.id == user.id
    end

    test "fetch_full_comment returns not_exist tuple on missing comment" do
      assert {:error, {:not_exist, reason}} = CMS.fetch_full_comment(9_999_999)
      assert is_binary(reason)
    end
  end
end
