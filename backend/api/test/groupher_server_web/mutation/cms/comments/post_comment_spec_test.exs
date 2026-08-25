defmodule GroupherServer.Test.Mutation.Comments.PostCommentSpec do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, post, _, user} = mock_article(:post)

    {:ok, post} =
      CMS.Articles.set_cat(post, GroupherServer.CMS.Artiment.Const.cat_map().qa)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community post)a}
  end

  describe "[post only: article comment solution]" do
    @query S.Comment.m(:accept_solution)
    test "questioner can accept a post comment as solution", ~m(community post)a do
      {:ok, post} = ORM.find(Post, post.id, preload: [author: :user])
      post_author = post.author.user

      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), post_author)

      questioner_conn = simu_conn(:user, post_author)

      variables = %{comment: comment_path(community, post, :post, comment)}

      result = questioner_conn |> gq_mutation(@query, variables)

      assert result["isForQuestion"]
      assert result["isSolution"]
    end

    test "other user can not accept a post comment as solution",
         ~m(guest_conn user_conn community post)a do
      {:ok, post} = ORM.find(Post, post.id, preload: [author: :user])
      post_author = post.author.user

      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), post_author)

      variables = %{comment: comment_path(community, post, :post, comment)}

      assert user_conn
             |> mutation_error?(
               @query,
               variables,
               ErrorCat.code(GroupherServer.CMS.Gate.ErrorCat.permission_denied())
             )

      assert guest_conn
             |> mutation_error?(
               @query,
               variables,
               ErrorCat.code(GroupherServer.Accounts.Profiles.ErrorCat.account_login())
             )
    end

    @query S.Comment.m(:revoke_solution)
    test "questioner can revoke a post comment solution", ~m(community post)a do
      {:ok, post} = ORM.find(Post, post.id, preload: [author: :user])
      post_author = post.author.user

      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), post_author)

      {:ok, comment} = CMS.Comments.accept_solution(comment.id, post_author)

      questioner_conn = simu_conn(:user, post_author)

      variables = %{comment: comment_path(community, post, :post, comment)}
      result = questioner_conn |> gq_mutation(@query, variables)

      assert result["isForQuestion"]
      assert not result["isSolution"]
    end

    test "other user can not revoke a post comment solution",
         ~m(guest_conn user_conn community post)a do
      {:ok, post} = ORM.find(Post, post.id, preload: [author: :user])
      post_author = post.author.user

      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), post_author)

      variables = %{comment: comment_path(community, post, :post, comment)}

      assert user_conn
             |> mutation_error?(
               @query,
               variables,
               ErrorCat.code(GroupherServer.CMS.Gate.ErrorCat.permission_denied())
             )

      assert guest_conn
             |> mutation_error?(
               @query,
               variables,
               ErrorCat.code(GroupherServer.Accounts.Profiles.ErrorCat.account_login())
             )
    end
  end
end
