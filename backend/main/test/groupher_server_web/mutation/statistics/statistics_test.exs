defmodule GroupherServer.Test.Mutation.Statistics do
  @moduledoc false

  use GroupherServer.TestTools

  alias GroupherServer.Statistics
  alias Statistics.Model.{CommunityContribute, UserContribute}
  # alias GroupherServer.Accounts.Model.User
  alias Helper.ORM

  setup do
    {community, post, post_attr, user} = mock_article(:post)
    {:ok, user2} = db_insert(:user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user2)

    {:ok, ~m(guest_conn user_conn community post user user2 post_attr)a}
  end

  describe "[statistics user_contribute] " do
    test "user should have contribute list after create a post",
         ~m(user_conn user2 community post_attr)a do
      variables = %{
        title: post_attr.title,
        body: post_attr.body,
        community: community.slug
      }

      user_conn |> mutation_result(Schema.m(:create_post), variables, "createPost")

      {:ok, contributes} = ORM.find_by(UserContribute, user_id: user2.id)
      assert contributes.count == 1
    end

    test "community should have contribute list after create a post",
         ~m(user_conn community post_attr)a do
      variables = %{
        title: post_attr.title,
        body: post_attr.body,
        community: community.slug
      }

      user_conn |> mutation_result(Schema.m(:create_post), variables, "createPost")

      {:ok, contributes} = ORM.find_by(CommunityContribute, community_id: community.id)
      assert contributes.count == 1
    end

    test "user should have contribute list after create a blog", ~m(user_conn user2 community)a do
      blog_attr = mock_attrs(:blog)
      variables = blog_attr |> Map.merge(%{community: community.slug}) |> camelize_map_key

      user_conn |> mutation_result(Schema.m(:create_blog), variables, "createBlog")

      {:ok, contributes} = ORM.find_by(UserContribute, user_id: user2.id)
      assert contributes.count == 1
    end

    @write_comment_query """
    mutation($community: String!, $thread: Thread!, $id: ID!, $body: String!) {
      createComment(community: $community, thread: $thread, id: $id, body: $body) {
        id
        bodyHtml
      }
    }
    """
    test "user should have contribute list after create a comment",
         ~m(user_conn community post user2)a do
      variables = %{
        community: community.slug,
        thread: "POST",
        id: post.inner_id,
        body: mock_comment()
      }

      user_conn |> mutation_result(@write_comment_query, variables, "createComment")

      {:ok, contributes} = ORM.find_by(UserContribute, user_id: user2.id)
      assert contributes.count == 1
    end
  end

  describe "[statistics mutation user_contribute] " do
    @query """
    mutation($userId: ID!) {
      makeContribute(userId: $userId) {
        date
        count
      }
    }
    """
    test "for guest user makeContribute should add record to user_contribute table",
         ~m(guest_conn user)a do
      variables = %{userId: user.id}
      assert {:error, _} = ORM.find_by(UserContribute, user_id: user.id)
      results = guest_conn |> mutation_result(@query, variables, "makeContribute")
      assert {:ok, _} = ORM.find_by(UserContribute, user_id: user.id)

      assert ["count", "date"] == results |> Map.keys()
      assert results["date"] == Timex.today() |> Date.to_iso8601()
      assert results["count"] == 1
    end

    test "makeContribute to same user should update contribute count", ~m(guest_conn user)a do
      variables = %{userId: user.id}
      guest_conn |> mutation_result(@query, variables, "makeContribute")
      results = guest_conn |> mutation_result(@query, variables, "makeContribute")
      assert ["count", "date"] == results |> Map.keys()
      assert results["date"] == Timex.today() |> Date.to_iso8601()
      assert results["count"] == 2
    end
  end
end
