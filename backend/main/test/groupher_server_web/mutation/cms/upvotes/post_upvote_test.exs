defmodule GroupherServer.Test.Mutation.Upvotes.PostUpvote do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {community, post, _, user} = mock_article(:post, preload: [author: :user])

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)
    user2_conn = simu_conn(:user)

    {:ok, ~m(user_conn user2_conn guest_conn community post user)a}
  end

  describe "[post upvote]" do
    test "tmp login user can upvote a post", ~m(user_conn user2_conn community post user)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}

      _created = user_conn |> gq_mutation(Schema.m(:upvote_article, :post), variables)
      created = user2_conn |> gq_mutation(Schema.m(:upvote_article, :post), variables)
      assert user_exist_in?(user, get_in(created, ["meta", "latestUpvotedUsers"]))

      assert created["innerId"] == to_string(post.inner_id)
      assert created["upvotesCount"] == 2
    end

    test "login user can upvote a post", ~m(user_conn user2_conn community post user)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}

      _created = user_conn |> gq_mutation(Schema.m(:upvote_article, :post), variables)
      created = user2_conn |> gq_mutation(Schema.m(:upvote_article, :post), variables)

      assert user_exist_in?(user, get_in(created, ["meta", "latestUpvotedUsers"]))

      assert created["innerId"] == to_string(post.inner_id)
      assert created["upvotesCount"] == 2
    end

    test "unauth user upvote a post fails", ~m(guest_conn community post)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:upvote_article, :post),
               variables,
               ecode(:account_login)
             )
    end

    test "login user can undo upvote to a post", ~m(user_conn community post user)a do
      {:ok, _} = CMS.Articles.upvote(post, user)

      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}

      updated = user_conn |> gq_mutation(Schema.m(:undo_upvote_article, :post), variables)

      assert not user_exist_in?(user, get_in(updated, ["meta", "latestUpvotedUsers"]))
      assert updated["innerId"] == to_string(post.inner_id)
    end

    test "unauth user undo upvote a post fails", ~m(guest_conn community post)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:undo_upvote_article, :post),
               variables,
               ecode(:account_login)
             )
    end
  end
end
