defmodule GroupherServer.Test.Mutation.Upvotes.DocUpvote do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {community, doc, _, user} = mock_article(:doc, preload: [author: :user])

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community doc user)a}
  end

  describe "[doc upvote]" do
    test "login user can upvote a doc", ~m(user_conn community doc user)a do
      variables = %{id: doc.inner_id, community: community.slug}

      created = user_conn |> gq_mutation(Schema.m(:upvote_article, :doc), variables)

      assert user_exist_in?(user, get_in(created, ["meta", "latestUpvotedUsers"]))
      assert created["id"] == to_string(doc.id)
    end

    test "unauth user upvote a doc fails", ~m(guest_conn community doc)a do
      variables = %{id: doc.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:upvote_article, :doc),
               variables,
               ecode(:account_login)
             )
    end

    test "login user can undo upvote to a doc", ~m(user_conn community doc user)a do
      {:ok, _} = CMS.upvote_article(doc, user)

      variables = %{id: doc.inner_id, community: community.slug}

      updated = user_conn |> gq_mutation(Schema.m(:undo_upvote_article, :doc), variables)

      assert not user_exist_in?(user, get_in(updated, ["meta", "latestUpvotedUsers"]))
      assert updated["id"] == to_string(doc.id)
    end

    test "unauth user undo upvote a doc fails", ~m(guest_conn community doc)a do
      variables = %{id: doc.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:undo_upvote_article, :doc),
               variables,
               ecode(:account_login)
             )
    end
  end
end
