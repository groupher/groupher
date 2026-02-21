defmodule GroupherServer.Test.Mutation.Comments.PostCommentSpec do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, post, _, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community post)a}
  end

  describe "[post only: article comment solution]" do
    @query """
    mutation($id: ID!) {
      markCommentSolution(id: $id) {
        id
        isForQuestion
        isSolution
      }
    }
    """
    test "questioner can mark a post comment as solution", ~m(community post)a do
      {:ok, post} = ORM.find(Post, post.id, preload: [author: :user])
      post_author = post.author.user

      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), post_author)

      questioner_conn = simu_conn(:user, post_author)

      variables = %{id: comment.id}

      result = questioner_conn |> gq_mutation(@query, variables)

      assert result["isForQuestion"]
      assert result["isSolution"]
    end

    test "other user can not mark a post comment as solution",
         ~m(guest_conn user_conn community post)a do
      {:ok, post} = ORM.find(Post, post.id, preload: [author: :user])
      post_author = post.author.user

      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), post_author)

      variables = %{id: comment.id}
      assert user_conn |> mutation_error?(@query, variables, ecode(:require_questioner))
      assert guest_conn |> mutation_error?(@query, variables, ecode(:account_login))
    end

    @query """
    mutation($id: ID!) {
      undoMarkCommentSolution(id: $id) {
        id
        isForQuestion
        isSolution
      }
    }
    """
    test "questioner can undo mark a post comment as solution", ~m(community post)a do
      {:ok, post} = ORM.find(Post, post.id, preload: [author: :user])
      post_author = post.author.user

      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), post_author)

      {:ok, comment} = CMS.Comments.mark_comment_solution(comment.id, post_author)

      questioner_conn = simu_conn(:user, post_author)

      variables = %{id: comment.id}
      result = questioner_conn |> gq_mutation(@query, variables)

      assert result["isForQuestion"]
      assert not result["isSolution"]
    end

    test "other user can not undo mark a post comment as solution",
         ~m(guest_conn user_conn community post)a do
      {:ok, post} = ORM.find(Post, post.id, preload: [author: :user])
      post_author = post.author.user

      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), post_author)

      variables = %{id: comment.id}
      assert user_conn |> mutation_error?(@query, variables, ecode(:require_questioner))
      assert guest_conn |> mutation_error?(@query, variables, ecode(:account_login))
    end
  end
end
