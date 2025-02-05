defmodule GroupherServer.Test.Mutation.Statistics do
  use GroupherServer.TestTools

  alias GroupherServer.Statistics
  alias Statistics.Model.{CommunityContribute, UserContribute}
  # alias GroupherServer.Accounts.Model.User
  alias Helper.ORM

  setup do
    guest_conn = simu_conn(:guest)
    {:ok, user} = db_insert(:user)
    user_conn = simu_conn(:user, user)

    {:ok, community} = db_insert(:community)

    {:ok, ~m(guest_conn user_conn community user)a}
  end

  describe "[statistics user_contribute] " do
    @create_post_query """
    mutation(
      $title: String!
      $body: String!
      $communityId: ID!
      $articleTags: [ID]
    ) {
      createPost(
        title: $title
        body: $body
        communityId: $communityId
        articleTags: $articleTags
      ) {
        title
        id
      }
    }
    """
    test "user should have contribute list after create a post", ~m(user_conn user community)a do
      post_attr = mock_attrs(:post)
      variables = post_attr |> Map.merge(%{communityId: community.id})

      user_conn |> mutation_result(@create_post_query, variables, "createPost")

      {:ok, contributes} = ORM.find_by(UserContribute, user_id: user.id)
      assert contributes.count == 1
    end

    test "community should have contribute list after create a post",
         ~m(user_conn community)a do
      post_attr = mock_attrs(:post)
      variables = post_attr |> Map.merge(%{communityId: community.id})

      user_conn |> mutation_result(@create_post_query, variables, "createPost")

      {:ok, contributes} = ORM.find_by(CommunityContribute, community_id: community.id)
      assert contributes.count == 1
    end

    @create_blog_query """
    mutation(
      $title: String!
      $body: String!
      $communityId: ID!
      $articleTags: [ID]
      $linkAddr: String
    ) {
      createBlog(
        title: $title
        body: $body
        communityId: $communityId
        articleTags: $articleTags
        linkAddr: $linkAddr
      ) {
        id
        title
        linkAddr
        document {
          bodyHtml
        }
        originalCommunity {
          id
        }
      }
    }
    """

    test "user should have contribute list after create a blog", ~m(user_conn user community)a do
      blog_attr = mock_attrs(:blog)
      variables = blog_attr |> Map.merge(%{communityId: community.id}) |> camelize_map_key

      user_conn |> mutation_result(@create_blog_query, variables, "createBlog")

      {:ok, contributes} = ORM.find_by(UserContribute, user_id: user.id)
      assert contributes.count == 1
    end

    @write_comment_query """
    mutation($thread: Thread!, $id: ID!, $body: String!) {
      createComment(thread: $thread, id: $id, body: $body) {
        id
        bodyHtml
      }
    }
    """

    test "user should have contribute list after create a comment", ~m(user_conn user)a do
      {:ok, post} = db_insert(:post)
      variables = %{thread: "POST", id: post.id, body: mock_comment()}
      user_conn |> mutation_result(@write_comment_query, variables, "createComment")

      {:ok, contributes} = ORM.find_by(UserContribute, user_id: user.id)
      assert contributes.count == 1
    end
  end

  describe "[statistics mutaion user_contribute] " do
    @query """
    mutation($userId: ID!) {
      makeContrubute(userId: $userId) {
        date
        count
      }
    }
    """
    test "for guest user makeContribute should add record to user_contribute table",
         ~m(guest_conn user)a do
      variables = %{userId: user.id}
      assert {:error, _} = ORM.find_by(UserContribute, user_id: user.id)
      results = guest_conn |> mutation_result(@query, variables, "makeContrubute")
      assert {:ok, _} = ORM.find_by(UserContribute, user_id: user.id)

      assert ["count", "date"] == results |> Map.keys()
      assert results["date"] == Timex.today() |> Date.to_iso8601()
      assert results["count"] == 1
    end

    test "makeContribute to same user should update contribute count", ~m(guest_conn user)a do
      variables = %{userId: user.id}
      guest_conn |> mutation_result(@query, variables, "makeContrubute")
      results = guest_conn |> mutation_result(@query, variables, "makeContrubute")
      assert ["count", "date"] == results |> Map.keys()
      assert results["date"] == Timex.today() |> Date.to_iso8601()
      assert results["count"] == 2
    end
  end
end
