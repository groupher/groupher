defmodule GroupherServer.Test.Mutation.Upvotes.DocUpvote do
  @moduledoc false
  use GroupherServer.TestMate

  setup do
    {community, doc, _, user} = mock_article(:doc, preload: [author: :user])

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community doc user)a}
  end

  describe "[doc upvote]" do
    test "login user can upvote a doc", ~m(user_conn community doc user)a do
      variables = %{article: %{inner_id: doc.inner_id, community: community.slug, thread: "DOC"}}

      created = user_conn |> gq_mutation(S.Article.m(:upvote_article, :doc), variables)

      assert user_exist_in?(user, get_in(created, ["meta", "latestUpvotedUsers"]))
      assert created["innerId"] == to_string(doc.inner_id)
    end

    test "unauth user upvote a doc fails", ~m(guest_conn community doc)a do
      variables = %{article: %{inner_id: doc.inner_id, community: community.slug, thread: "DOC"}}

      assert guest_conn
             |> mutation_error?(
               S.Article.m(:upvote_article, :doc),
               variables,
               ErrorCat.code(GroupherServer.Accounts.Profiles.ErrorCat.account_login())
             )
    end

    test "login user can undo upvote to a doc", ~m(user_conn community doc user)a do
      {:ok, _} = CMS.Interactions.upvote(doc, user)

      variables = %{article: %{inner_id: doc.inner_id, community: community.slug, thread: "DOC"}}

      updated = user_conn |> gq_mutation(S.Article.m(:undo_upvote_article, :doc), variables)

      assert not user_exist_in?(user, get_in(updated, ["meta", "latestUpvotedUsers"]))
      assert updated["innerId"] == to_string(doc.inner_id)
    end

    test "unauth user undo upvote a doc fails", ~m(guest_conn community doc)a do
      variables = %{article: %{inner_id: doc.inner_id, community: community.slug, thread: "DOC"}}

      assert guest_conn
             |> mutation_error?(
               S.Article.m(:undo_upvote_article, :doc),
               variables,
               ErrorCat.code(GroupherServer.Accounts.Profiles.ErrorCat.account_login())
             )
    end
  end
end
