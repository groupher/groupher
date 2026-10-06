defmodule GroupherServer.Test.Query.CMS.Interactions.ReadStateContractTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias GroupherServerWeb.Schema

  @operation """
  query ReadStateContract(
    $paths: [ArticlePathInput!]!
    $article: ArticlePathInput!
    $commentInnerIds: [ID!]!
  ) {
    articleViewerStates(paths: $paths) {
      community
      thread
      innerId
      viewerHasViewed
    }
    articleInteractionStates(paths: $paths) {
      community
      thread
      innerId
      interactionRevision
      viewerHasUpvoted
      viewerHasCollected
      viewerEmotion
    }
    commentViewerStates(article: $article, commentInnerIds: $commentInnerIds) {
      innerId
      viewerHasUpvoted
      viewerHasReported
      emotions {
        type
        viewerHasReacted
      }
    }
    commentReconcileStates(article: $article, commentInnerIds: $commentInnerIds) {
      article {
        innerId
        commentsRevision
      }
      entries {
        commentInnerId
        comment {
          innerId
          commentInteractionRevision
          viewerHasUpvoted
          viewerHasReported
          emotions {
            type
            count
            viewerHasReacted
          }
        }
      }
    }
  }
  """

  test "authenticated batch read exposes the complete selected response shape" do
    {community, post, _attrs, user} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

    assert {:ok, _} = CMS.Interactions.upvote(post, user)
    assert {:ok, _} = CMS.Interactions.emotion(post, :beer, user)
    assert {:ok, _} = CMS.Interactions.upvote(comment, user)
    assert {:ok, _} = CMS.Interactions.emotion(comment, :downvote, user)

    article = %{
      "community" => community.slug,
      "thread" => "POST",
      "innerId" => Integer.to_string(post.inner_id)
    }

    variables = %{
      "paths" => [article],
      "article" => article,
      "commentInnerIds" => [Integer.to_string(comment.inner_id), "999999"]
    }

    assert {:ok, %{data: response}} =
             Absinthe.run(@operation, Schema,
               variables: variables,
               context: %{cur_user: user}
             )

    article_inner_id = Integer.to_string(post.inner_id)
    comment_inner_id = Integer.to_string(comment.inner_id)

    assert response == %{
             "articleViewerStates" => [
               %{
                 "community" => community.slug,
                 "thread" => "POST",
                 "innerId" => article_inner_id,
                 "viewerHasViewed" => false
               }
             ],
             "articleInteractionStates" => [
               %{
                 "community" => community.slug,
                 "thread" => "POST",
                 "innerId" => article_inner_id,
                 "interactionRevision" => 2,
                 "viewerHasUpvoted" => true,
                 "viewerHasCollected" => false,
                 "viewerEmotion" => "BEER"
               }
             ],
             "commentViewerStates" => [
               %{
                 "innerId" => comment_inner_id,
                 "viewerHasUpvoted" => true,
                 "viewerHasReported" => false,
                 "emotions" => [
                   %{"type" => "DOWNVOTE", "viewerHasReacted" => true}
                 ]
               }
             ],
             "commentReconcileStates" => %{
               "article" => %{
                 "innerId" => post.inner_id,
                 "commentsRevision" => 1
               },
               "entries" => [
                 %{
                   "commentInnerId" => comment_inner_id,
                   "comment" => %{
                     "innerId" => comment_inner_id,
                     "commentInteractionRevision" => 2,
                     "viewerHasUpvoted" => true,
                     "viewerHasReported" => false,
                     "emotions" => [
                       %{
                         "type" => "DOWNVOTE",
                         "count" => 1,
                         "viewerHasReacted" => true
                       }
                     ]
                   }
                 },
                 %{"commentInnerId" => "999999", "comment" => nil}
               ]
             }
           }
  end

  test "anonymous private-state fields stay empty while reconciliation remains readable" do
    {community, post, _attrs, user} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

    article = %{
      "community" => community.slug,
      "thread" => "POST",
      "innerId" => Integer.to_string(post.inner_id)
    }

    variables = %{
      "paths" => [article],
      "article" => article,
      "commentInnerIds" => [Integer.to_string(comment.inner_id)]
    }

    assert {:ok, %{data: response}} =
             Absinthe.run(@operation, Schema, variables: variables, context: %{cur_user: nil})

    assert response["articleViewerStates"] == []
    assert response["articleInteractionStates"] == []
    assert response["commentViewerStates"] == []

    assert response["commentReconcileStates"]["entries"] == [
             %{
               "commentInnerId" => Integer.to_string(comment.inner_id),
               "comment" => %{
                 "innerId" => Integer.to_string(comment.inner_id),
                 "commentInteractionRevision" => 0,
                 "viewerHasUpvoted" => false,
                 "viewerHasReported" => false,
                 "emotions" => []
               }
             }
           ]
  end
end
