defmodule GroupherServer.Test.Mutation.Upvotes.DocUpvote do
  @moduledoc false
  use GroupherServer.TestMate
  alias GroupherServer.Accounts
  alias Accounts.Profiles.ErrorCat

  setup do
    {community, doc, _, user} = mock_article(:doc, preload: [author: :user])

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community doc user)a}
  end

  describe "[doc upvote]" do
    test "login user can upvote a doc", ~m(user_conn community doc)a do
      variables = %{
        article: %{
          inner_id: article_inner_id(doc, community),
          community: community.slug,
          thread: "DOC"
        }
      }

      created = user_conn |> gq_mutation(S.Article.m(:upvote_article, :doc), variables)

      assert get_in(created, ["interactionState", "viewerHasUpvoted"])

      assert get_in(created, ["interactionState", "innerId"]) ==
               to_string(article_inner_id(doc, community))
    end

    test "unauth user upvote a doc fails", ~m(guest_conn community doc)a do
      variables = %{
        article: %{
          inner_id: article_inner_id(doc, community),
          community: community.slug,
          thread: "DOC"
        }
      }

      assert guest_conn
             |> mutation_error?(
               S.Article.m(:upvote_article, :doc),
               variables,
               ErrorCat.code(ErrorCat.account_login())
             )
    end

    test "login user can undo upvote to a doc", ~m(user_conn community doc user)a do
      {:ok, _} = CMS.Interactions.upvote(doc, user, Ecto.UUID.generate())

      variables = %{
        article: %{
          inner_id: article_inner_id(doc, community),
          community: community.slug,
          thread: "DOC"
        }
      }

      updated = user_conn |> gq_mutation(S.Article.m(:undo_upvote_article, :doc), variables)

      refute get_in(updated, ["interactionState", "viewerHasUpvoted"])

      assert get_in(updated, ["interactionState", "innerId"]) ==
               to_string(article_inner_id(doc, community))
    end

    test "unauth user undo upvote a doc fails", ~m(guest_conn community doc)a do
      variables = %{
        article: %{
          inner_id: article_inner_id(doc, community),
          community: community.slug,
          thread: "DOC"
        }
      }

      assert guest_conn
             |> mutation_error?(
               S.Article.m(:undo_upvote_article, :doc),
               variables,
               ErrorCat.code(ErrorCat.account_login())
             )
    end
  end
end
