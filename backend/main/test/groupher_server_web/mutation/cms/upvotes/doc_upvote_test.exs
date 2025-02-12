defmodule GroupherServer.Test.Mutation.Upvotes.DocUpvote do
  @moduledoc false
  use GroupherServer.TestTools

  alias GroupherServer.CMS

  setup do
    {:ok, doc} = db_insert(:doc)
    {:ok, user} = db_insert(:user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn doc user)a}
  end

  describe "[doc upvote]" do
    @query """
    mutation($id: ID!) {
      upvoteDoc(id: $id) {
        id
        meta {
          latestUpvotedUsers {
            login
          }
        }
      }
    }
    """

    test "login user can upvote a doc", ~m(user_conn user doc)a do
      variables = %{id: doc.id}
      created = user_conn |> mutation_result(@query, variables, "upvoteDoc")

      assert user_exist_in?(user, get_in(created, ["meta", "latestUpvotedUsers"]))
      assert created["id"] == to_string(doc.id)
    end

    test "unauth user upvote a doc fails", ~m(guest_conn doc)a do
      variables = %{id: doc.id}

      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
    end

    @query """
    mutation($id: ID!) {
      undoUpvoteDoc(id: $id) {
        id
        meta {
          latestUpvotedUsers {
            login
          }
        }
      }
    }
    """

    test "login user can undo upvote to a doc", ~m(user_conn doc user)a do
      {:ok, _} = CMS.upvote_article(:doc, doc.id, user)

      variables = %{id: doc.id}
      updated = user_conn |> mutation_result(@query, variables, "undoUpvoteDoc")

      assert not user_exist_in?(user, get_in(updated, ["meta", "latestUpvotedUsers"]))
      assert updated["id"] == to_string(doc.id)
    end

    test "unauth user undo upvote a doc fails", ~m(guest_conn doc)a do
      variables = %{id: doc.id}

      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
    end
  end
end
