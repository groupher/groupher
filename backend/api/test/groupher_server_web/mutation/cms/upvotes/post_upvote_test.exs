defmodule GroupherServer.Test.Mutation.Upvotes.PostUpvote do
  @moduledoc false
  use GroupherServer.TestMate
  alias GroupherServer.Accounts
  alias Accounts.Profiles.ErrorCat

  setup do
    {community, post, _, user} = mock_article(:post, preload: [author: :user])

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)
    user2_conn = simu_conn(:user)

    {:ok, ~m(user_conn user2_conn guest_conn community post user)a}
  end

  describe "[post upvote]" do
    test "tmp login user can upvote a post", ~m(user_conn user2_conn community post)a do
      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        }
      }

      _created = user_conn |> gq_mutation(S.Article.m(:upvote_article, :post), variables)
      created = user2_conn |> gq_mutation(S.Article.m(:upvote_article, :post), variables)
      assert get_in(created, ["interactionState", "viewerHasUpvoted"])

      assert get_in(created, ["interactionState", "innerId"]) ==
               to_string(article_inner_id(post, community))

      assert created["articleStats"]["upvotesCount"] == 2
    end

    test "login user can upvote a post", ~m(user_conn user2_conn community post)a do
      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        }
      }

      _created = user_conn |> gq_mutation(S.Article.m(:upvote_article, :post), variables)
      created = user2_conn |> gq_mutation(S.Article.m(:upvote_article, :post), variables)

      assert get_in(created, ["interactionState", "viewerHasUpvoted"])

      assert get_in(created, ["interactionState", "innerId"]) ==
               to_string(article_inner_id(post, community))

      assert created["articleStats"]["upvotesCount"] == 2
    end

    test "unauth user upvote a post fails", ~m(guest_conn community post)a do
      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        }
      }

      assert guest_conn
             |> mutation_error?(
               S.Article.m(:upvote_article, :post),
               variables,
               ErrorCat.code(ErrorCat.account_login())
             )
    end

    test "login user can undo upvote to a post", ~m(user_conn community post user)a do
      {:ok, _} = CMS.Interactions.upvote(post, user, Ecto.UUID.generate())

      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        }
      }

      updated = user_conn |> gq_mutation(S.Article.m(:undo_upvote_article, :post), variables)

      refute get_in(updated, ["interactionState", "viewerHasUpvoted"])

      assert get_in(updated, ["interactionState", "innerId"]) ==
               to_string(article_inner_id(post, community))
    end

    test "duplicate upvote is idempotent and count does not increase",
         ~m(user_conn community post)a do
      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        }
      }

      created = user_conn |> gq_mutation(S.Article.m(:upvote_article, :post), variables)
      assert get_in(created, ["interactionState", "viewerHasUpvoted"])
      assert created["articleStats"]["upvotesCount"] == 1

      unchanged = user_conn |> gq_mutation(S.Article.m(:upvote_article, :post), variables)
      assert unchanged["articleStats"]["upvotesCount"] == 1

      {:ok, current_post} = read_article(community, :post, article_inner_id(post, community))
      counts = CMS.Interactions.counts([current_post])
      assert counts[{:post, current_post.id}].upvotes_count == 1
    end

    test "command id replay returns the same confirmed state",
         ~m(user_conn community post)a do
      command_id = Ecto.UUID.generate()

      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        },
        commandId: command_id
      }

      first =
        user_conn
        |> gq_mutation(S.Article.m(:upvote_article_with_command_id, :post), variables)

      replay =
        user_conn
        |> gq_mutation(S.Article.m(:upvote_article_with_command_id, :post), variables)

      assert replay == first
      assert first["commandId"] == command_id
      assert replay["commandId"] == command_id
      assert replay["reactionOutcome"] == "CHANGED"
      assert replay["articleStats"]["upvotesCount"] == first["articleStats"]["upvotesCount"]

      assert replay["articleStats"]["interactionRevision"] ==
               first["articleStats"]["interactionRevision"]
    end

    test "command id replay preserves an unchanged outcome",
         ~m(user_conn community post user)a do
      {:ok, _} = CMS.Interactions.upvote(post, user, Ecto.UUID.generate())
      command_id = Ecto.UUID.generate()

      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        },
        commandId: command_id
      }

      first =
        user_conn
        |> gq_mutation(S.Article.m(:upvote_article_with_command_id, :post), variables)

      replay =
        user_conn
        |> gq_mutation(S.Article.m(:upvote_article_with_command_id, :post), variables)

      assert replay == first
      assert first["reactionOutcome"] == "UNCHANGED"
      assert replay["reactionOutcome"] == "UNCHANGED"
      assert replay["articleStats"]["upvotesCount"] == first["articleStats"]["upvotesCount"]
    end

    test "undo upvote is idempotent (can undo even if not upvoted)",
         ~m(user_conn community post)a do
      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        }
      }

      result = user_conn |> gq_mutation(S.Article.m(:undo_upvote_article, :post), variables)

      assert get_in(result, ["interactionState", "innerId"]) ==
               to_string(article_inner_id(post, community))
    end

    test "unauth user undo upvote a post fails", ~m(guest_conn community post)a do
      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        }
      }

      assert guest_conn
             |> mutation_error?(
               S.Article.m(:undo_upvote_article, :post),
               variables,
               ErrorCat.code(ErrorCat.account_login())
             )
    end
  end
end
