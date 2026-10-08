defmodule GroupherServer.Test.Mutation.Upvotes.ChangelogUpvote do
  @moduledoc false
  use GroupherServer.TestMate
  alias GroupherServer.Accounts
  alias Accounts.Profiles.ErrorCat

  setup do
    {community, changelog, _, user} = mock_article(:changelog, preload: [author: :user])

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community changelog user)a}
  end

  describe "[changelog upvote]" do
    test "login user can upvote a changelog", ~m(user_conn community changelog)a do
      variables = %{
        article: %{inner_id: article_inner_id(changelog, community), community: community.slug, thread: "CHANGELOG"}
      }

      created = user_conn |> gq_mutation(S.Article.m(:upvote_article, :changelog), variables)

      assert get_in(created, ["interactionState", "viewerHasUpvoted"])
      assert get_in(created, ["interactionState", "innerId"]) == to_string(article_inner_id(changelog, community))
    end

    test "unauth user upvote a changelog fails", ~m(guest_conn community changelog)a do
      variables = %{
        article: %{inner_id: article_inner_id(changelog, community), community: community.slug, thread: "CHANGELOG"}
      }

      assert guest_conn
             |> mutation_error?(
               S.Article.m(:upvote_article, :changelog),
               variables,
               ErrorCat.code(ErrorCat.account_login())
             )
    end

    test "login user can undo upvote to a changelog", ~m(user_conn community changelog user)a do
      {:ok, _} = CMS.Interactions.upvote(changelog, user)

      variables = %{
        article: %{inner_id: article_inner_id(changelog, community), community: community.slug, thread: "CHANGELOG"}
      }

      updated =
        user_conn |> gq_mutation(S.Article.m(:undo_upvote_article, :changelog), variables)

      refute get_in(updated, ["interactionState", "viewerHasUpvoted"])
      assert get_in(updated, ["interactionState", "innerId"]) == to_string(article_inner_id(changelog, community))
    end

    test "unauth user undo upvote a changelog fails", ~m(guest_conn community changelog)a do
      variables = %{
        article: %{inner_id: article_inner_id(changelog, community), community: community.slug, thread: "CHANGELOG"}
      }

      assert guest_conn
             |> mutation_error?(
               S.Article.m(:undo_upvote_article, :changelog),
               variables,
               ErrorCat.code(ErrorCat.account_login())
             )
    end
  end
end
