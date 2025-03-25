defmodule GroupherServer.Test.Mutation.Upvotes.ChangelogUpvote do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {community, changelog, _, user} = mock_article(:changelog, preload: [author: :user])

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community changelog user)a}
  end

  describe "[changelog upvote]" do
    @tag :wip
    test "login user can upvote a changelog", ~m(user_conn community changelog user)a do
      variables = %{id: changelog.inner_id, community: community.slug}

      created =
        user_conn
        |> mutation_result(Schema.m(:upvote_article, :changelog), variables, "upvoteChangelog")

      assert user_exist_in?(user, get_in(created, ["meta", "latestUpvotedUsers"]))
      assert created["id"] == to_string(changelog.id)
    end

    @tag :wip
    test "unauth user upvote a changelog fails", ~m(guest_conn community changelog)a do
      variables = %{id: changelog.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_get_error?(
               Schema.m(:upvote_article, :changelog),
               variables,
               ecode(:account_login)
             )
    end

    @tag :wip
    test "login user can undo upvote to a changelog", ~m(user_conn community changelog user)a do
      {:ok, _} = CMS.upvote_article(changelog, user)

      variables = %{id: changelog.inner_id, community: community.slug}

      updated =
        user_conn
        |> mutation_result(
          Schema.m(:undo_upvote_article, :changelog),
          variables,
          "undoUpvoteChangelog"
        )

      assert not user_exist_in?(user, get_in(updated, ["meta", "latestUpvotedUsers"]))
      assert updated["id"] == to_string(changelog.id)
    end

    @tag :wip
    test "unauth user undo upvote a changelog fails", ~m(guest_conn community changelog)a do
      variables = %{id: changelog.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_get_error?(
               Schema.m(:undo_upvote_article, :changelog),
               variables,
               ecode(:account_login)
             )
    end
  end
end
