defmodule GroupherServer.Test.Mutation.Upvotes.ChangelogUpvote do
  @moduledoc false
  use GroupherServer.TestTools

  alias GroupherServer.CMS

  setup do
    {:ok, changelog} = db_insert(:changelog)
    {:ok, user} = db_insert(:user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn changelog user)a}
  end

  describe "[changelog upvote]" do
    @query """
    mutation($id: ID!) {
      upvoteChangelog(id: $id) {
        id
        meta {
          latestUpvotedUsers {
            login
          }
        }
      }
    }
    """

    test "login user can upvote a changelog", ~m(user_conn user changelog)a do
      variables = %{id: changelog.id}
      created = user_conn |> mutation_result(@query, variables, "upvoteChangelog")

      assert user_exist_in?(user, get_in(created, ["meta", "latestUpvotedUsers"]))
      assert created["id"] == to_string(changelog.id)
    end

    test "unauth user upvote a changelog fails", ~m(guest_conn changelog)a do
      variables = %{id: changelog.id}

      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
    end

    @query """
    mutation($id: ID!) {
      undoUpvoteChangelog(id: $id) {
        id
        meta {
          latestUpvotedUsers {
            login
          }
        }
      }
    }
    """

    test "login user can undo upvote to a changelog", ~m(user_conn changelog user)a do
      {:ok, _} = CMS.upvote_article(:changelog, changelog.id, user)

      variables = %{id: changelog.id}
      updated = user_conn |> mutation_result(@query, variables, "undoUpvoteChangelog")

      assert not user_exist_in?(user, get_in(updated, ["meta", "latestUpvotedUsers"]))
      assert updated["id"] == to_string(changelog.id)
    end

    test "unauth user undo upvote a changelog fails", ~m(guest_conn changelog)a do
      variables = %{id: changelog.id}

      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
    end
  end
end
