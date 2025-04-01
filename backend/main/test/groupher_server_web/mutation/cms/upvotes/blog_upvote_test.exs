defmodule GroupherServer.Test.Mutation.Upvotes.BlogUpvote do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {community, blog, _, user} = mock_article(:blog, preload: [author: :user])

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community blog user)a}
  end

  describe "[blog upvote]" do
    test "login user can upvote a blog", ~m(user_conn community blog user)a do
      variables = %{id: blog.inner_id, community: community.slug}

      created = user_conn |> gq_mutation(Schema.m(:upvote_article, :blog), variables)

      assert user_exist_in?(user, get_in(created, ["meta", "latestUpvotedUsers"]))
      assert created["id"] == to_string(blog.id)
    end

    test "unauth user upvote a blog fails", ~m(guest_conn community blog)a do
      variables = %{id: blog.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:upvote_article, :blog),
               variables,
               ecode(:account_login)
             )
    end

    test "login user can undo upvote to a blog", ~m(user_conn community blog user)a do
      {:ok, _} = CMS.upvote_article(blog, user)

      variables = %{id: blog.inner_id, community: community.slug}

      updated = user_conn |> gq_mutation(Schema.m(:undo_upvote_article, :blog), variables)

      assert not user_exist_in?(user, get_in(updated, ["meta", "latestUpvotedUsers"]))
      assert updated["id"] == to_string(blog.id)
    end

    test "unauth user undo upvote a blog fails", ~m(guest_conn community blog)a do
      variables = %{id: blog.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:undo_upvote_article, :blog),
               variables,
               ecode(:account_login)
             )
    end
  end
end
