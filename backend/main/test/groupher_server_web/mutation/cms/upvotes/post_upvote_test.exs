defmodule GroupherServer.Test.Mutation.Upvotes.PostUpvote do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {community, post, _, user} = mock_article(:post, preload: [author: :user])

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community post user)a}
  end

  describe "[post upvote]" do
    test "login user can upvote a post", ~m(user_conn community post user)a do
      variables = %{id: post.inner_id, community: community.slug}

      created =
        user_conn |> mutation_result(Schema.m(:upvote_article, :post), variables, "upvotePost")

      assert user_exist_in?(user, get_in(created, ["meta", "latestUpvotedUsers"]))
      assert created["id"] == to_string(post.id)
    end

    test "unauth user upvote a post fails", ~m(guest_conn community post)a do
      variables = %{id: post.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_get_error?(
               Schema.m(:upvote_article, :post),
               variables,
               ecode(:account_login)
             )
    end

    test "login user can undo upvote to a post", ~m(user_conn community post user)a do
      {:ok, _} = CMS.upvote_article(post, user)

      variables = %{id: post.inner_id, community: community.slug}

      updated =
        user_conn
        |> mutation_result(Schema.m(:undo_upvote_article, :post), variables, "undoUpvotePost")

      assert not user_exist_in?(user, get_in(updated, ["meta", "latestUpvotedUsers"]))
      assert updated["id"] == to_string(post.id)
    end

    test "unauth user undo upvote a post fails", ~m(guest_conn community post)a do
      variables = %{id: post.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_get_error?(
               Schema.m(:undo_upvote_article, :post),
               variables,
               ecode(:account_login)
             )
    end
  end
end
