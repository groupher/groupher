defmodule GroupherServer.Test.Mutation.Upvotes.BlogUpvote do
  @moduledoc false
  use GroupherServer.TestMate
  alias GroupherServer.Accounts
  alias Accounts.Profiles.ErrorCat

  setup do
    {community, blog, _, user} = mock_article(:blog, preload: [author: :user])

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community blog user)a}
  end

  describe "[blog upvote]" do
    test "login user can upvote a blog", ~m(user_conn community blog)a do
      variables = %{
        article: %{inner_id: blog.inner_id, community: community.slug, thread: "BLOG"}
      }

      created = user_conn |> gq_mutation(S.Article.m(:upvote_article, :blog), variables)

      assert get_in(created, ["interactionState", "viewerHasUpvoted"])
      assert get_in(created, ["interactionState", "innerId"]) == to_string(blog.inner_id)
    end

    test "unauth user upvote a blog fails", ~m(guest_conn community blog)a do
      variables = %{
        article: %{inner_id: blog.inner_id, community: community.slug, thread: "BLOG"}
      }

      assert guest_conn
             |> mutation_error?(
               S.Article.m(:upvote_article, :blog),
               variables,
               ErrorCat.code(ErrorCat.account_login())
             )
    end

    test "login user can undo upvote to a blog", ~m(user_conn community blog user)a do
      {:ok, _} = CMS.Interactions.upvote(blog, user)

      variables = %{
        article: %{inner_id: blog.inner_id, community: community.slug, thread: "BLOG"}
      }

      updated = user_conn |> gq_mutation(S.Article.m(:undo_upvote_article, :blog), variables)

      refute get_in(updated, ["interactionState", "viewerHasUpvoted"])
      assert get_in(updated, ["interactionState", "innerId"]) == to_string(blog.inner_id)
    end

    test "unauth user undo upvote a blog fails", ~m(guest_conn community blog)a do
      variables = %{
        article: %{inner_id: blog.inner_id, community: community.slug, thread: "BLOG"}
      }

      assert guest_conn
             |> mutation_error?(
               S.Article.m(:undo_upvote_article, :blog),
               variables,
               ErrorCat.code(ErrorCat.account_login())
             )
    end
  end
end
