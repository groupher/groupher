defmodule GroupherServer.Test.Helper.Schema.Comment do
  @moduledoc "GraphQL documents used by comment tests."

  def m(:create_comment_2) do
    """
    mutation($article: ArticlePathInput!, $body: ArtimentBodyBagInput!, $commandId: ID!) {
          createComment(article: $article, bodyBag: $body, commandId: $commandId) {
            commandId
            comment {
              innerId
              body { html }
            }
            articleStats {
              innerId
              commentsRevision
            }
          }
        }
    """
  end

  def m(:create_comment) do
    """
    mutation($article: ArticlePathInput!, $body: ArtimentBodyBagInput!, $commandId: ID!) {
      createComment(article: $article, bodyBag: $body, commandId: $commandId) {
        commandId
        comment {
          innerId
          body { html }
        }
        articleStats {
          innerId
          commentsRevision
        }
      }
    }
    """
  end

  def m(:create_comment_with_command_id) do
    """
    mutation($article: ArticlePathInput!, $body: ArtimentBodyBagInput!, $commandId: ID!) {
      createComment(article: $article, bodyBag: $body, commandId: $commandId) {
        commandId
        comment {
          innerId
          body { html }
        }
        articleStats {
          innerId
          commentsRevision
        }
      }
    }
    """
  end

  def m(:update_comment) do
    """
    mutation($comment: CommentPathInput!, $body: ArtimentBodyBagInput!, $expectedVersion: Int! = 1, $commandId: ID!) {
      updateComment(comment: $comment, bodyBag: $body, expectedVersion: $expectedVersion, commandId: $commandId) {
        commandId
        comment {
          innerId
          body { html }
        }
        articleStats {
          innerId
          commentsRevision
        }
      }
    }
    """
  end

  def m(:update_comment_with_command_id) do
    """
    mutation($comment: CommentPathInput!, $body: ArtimentBodyBagInput!, $expectedVersion: Int! = 1, $commandId: ID!) {
      updateComment(comment: $comment, bodyBag: $body, expectedVersion: $expectedVersion, commandId: $commandId) {
        commandId
        comment {
          innerId
          body { html }
        }
        articleStats {
          innerId
          thread
          commentsRevision
        }
      }
    }
    """
  end

  def m(:delete_comment) do
    """
    mutation($comment: CommentPathInput!, $commandId: ID!) {
      deleteComment(comment: $comment, commandId: $commandId) {
        commandId
        comment {
          innerId
        }
        articleStats {
          innerId
          commentsRevision
        }
      }
    }
    """
  end

  def m(:delete_comment_with_command_id) do
    """
    mutation($comment: CommentPathInput!, $commandId: ID!) {
      deleteComment(comment: $comment, commandId: $commandId) {
        commandId
        comment {
          innerId
        }
        articleStats {
          innerId
          thread
          commentsRevision
        }
      }
    }
    """
  end

  def m(:reply_comment) do
    """
    mutation($comment: CommentPathInput!, $body: ArtimentBodyBagInput!, $commandId: ID!) {
      replyComment(comment: $comment, bodyBag: $body, commandId: $commandId) {
        commandId
        comment {
          innerId
          body { html }
        }
        articleStats {
          innerId
          commentsRevision
        }
      }
    }
    """
  end

  def m(:reply_comment_with_command_id) do
    """
    mutation($comment: CommentPathInput!, $body: ArtimentBodyBagInput!, $commandId: ID!) {
      replyComment(comment: $comment, bodyBag: $body, commandId: $commandId) {
        commandId
        comment {
          innerId
          body { html }
        }
        articleStats {
          innerId
          commentsRevision
        }
      }
    }
    """
  end

  def m(:upvote_comment) do
    """
    mutation($comment: CommentPathInput!, $commandId: ID!) {
      upvoteComment(comment: $comment, commandId: $commandId) {
        innerId
        upvotesCount
        viewerHasUpvoted
      }
    }
    """
  end

  def m(:undo_upvote_comment) do
    """
    mutation($comment: CommentPathInput!, $commandId: ID!) {
      undoUpvoteComment(comment: $comment, commandId: $commandId) {
        innerId
        upvotesCount
        viewerHasUpvoted
      }
    }
    """
  end

  def m(:pin_comment) do
    """
    mutation($comment: CommentPathInput!, $commandId: ID!){
      pinComment(comment: $comment, commandId: $commandId) {
        innerId
        isPinned
      }
    }
    """
  end

  def m(:undo_pin_comment) do
    """
    mutation($comment: CommentPathInput!, $commandId: ID!){
      undoPinComment(comment: $comment, commandId: $commandId) {
        innerId
        isPinned
      }
    }
    """
  end

  def m(:emotion_to_comment) do
    """
    mutation($comment: CommentPathInput!, $emotion: CommentEmotion!, $commandId: ID!) {
      emotionToComment(comment: $comment, emotion: $emotion, commandId: $commandId) {
        innerId
        emotions {
          type
          count
          viewerHasReacted
          latestUsers {
            login
            nickname
          }
        }
      }
    }
    """
  end

  def m(:undo_emotion_to_comment) do
    """
    mutation($comment: CommentPathInput!, $emotion: CommentEmotion!, $commandId: ID!) {
      undoEmotionToComment(comment: $comment, emotion: $emotion, commandId: $commandId) {
        innerId
        emotions {
          type
          count
          viewerHasReacted
          latestUsers {
            login
            nickname
          }
        }
      }
    }
    """
  end

  def m(:accept_solution) do
    """
    mutation($comment: CommentPathInput!, $commandId: ID!) {
      acceptSolution(comment: $comment, commandId: $commandId) {
        innerId
        isForQuestion
        isSolution
      }
    }
    """
  end

  def m(:revoke_solution) do
    """
    mutation($comment: CommentPathInput!, $commandId: ID!) {
      revokeSolution(comment: $comment, commandId: $commandId) {
        innerId
        isForQuestion
        isSolution
      }
    }
    """
  end

  def q(:paged_published_comments) do
    """
    query($login: String!, $thread: Thread, $filter: CommentPageFilter, $pagi: PagiInput) {
      pagedPublishedComments(login: $login, thread: $thread, filter: $filter, pagi: $pagi) {
        entries {
          innerId
          body { html }
          author {
            login
          }
          article {
            innerId
            title
            thread
            author {
              nickname
              login
            }
          }
        }
        pageInfo { hasNextPage ... on OffsetPageInfo { page size totalPages totalCount } ... on CursorPageInfo { endCursor } }
      }
    }
    """
  end

  def q(:one_comment_emotions) do
    """
    query($comment: CommentPathInput!) {
      oneComment(comment: $comment) {
        innerId
        emotions {
          type
          count
          viewerHasReacted
          latestUsers {
            login
          }
        }
      }
    }
    """
  end

  def q(:comments_state) do
    """
    query($article: ArticlePathInput!) {
        commentsState(article: $article) {
          totalCount
          isViewerJoined
          participantsCount

          participants {
            login
            nickname
            avatar
          }
        }
      }
    """
  end

  def q(:one_comment) do
    """
    query($comment: CommentPathInput!) {
        oneComment(comment: $comment) {
          innerId
          body { html }
          viewerHasUpvoted
          emotions {
            type
            count
            viewerHasReacted
          }
        }
      }
    """
  end

  def q(:comment_page) do
    """
    query($article: ArticlePathInput!, $mode: CommentsMode, $filter: CommentPageFilter, $pagi: PagiInput) {
            commentPage(article: $article, mode: $mode, filter: $filter, pagi: $pagi) {
              entries {
                innerId
                body { html }
                author {
                  login
                  nickname
                }
                isPinned
                floor
                upvotesCount

                emotions {
                  type
                  count
                  latestUsers {
                    login
                    nickname
                  }
                  viewerHasReacted
                }
                isArticleAuthor
                meta {
                  isArticleAuthorUpvoted
                }
                replyToComment {
                  innerId
                  body { html }
                  floor
                  isArticleAuthor
                  author {
                    login
                    nickname
                  }
                }
                viewerHasUpvoted
                replies {
                  innerId
                  body { html }
                  replyToComment {
                    innerId
                    author {
                      login
                      nickname
                    }
                  }
                  repliesCount
                  author {
                    login
                    nickname
                  }
                }
                repliesCount
              }
              pageInfo { __typename ... on OffsetPageInfo { totalPages totalCount size page } }
              pinnedEntries { innerId isSolution isPinned }
            }
        }
    """
  end

  def q(:paged_comments_participants) do
    """
    query($article: ArticlePathInput!, $pagi: PagiInput) {
            pagedCommentsParticipants(article: $article, pagi: $pagi) {
              entries {
                login
                nickname
              }
            pageInfo { hasNextPage ... on OffsetPageInfo { page size totalCount totalPages } ... on CursorPageInfo { endCursor } }
            }
        }
    """
  end

  def q(:comment_reply_page) do
    """
    query($comment: CommentPathInput!, $filter: CommentPageFilter, $pagi: PagiInput) {
            commentReplyPage(comment: $comment, filter: $filter, pagi: $pagi) {
              entries {
                innerId
                body { html }
                author {
                  login
                  nickname
                }
                upvotesCount
                emotions {
                  type
                  count
                  latestUsers {
                    login
                    nickname
                  }
                  viewerHasReacted
                }
                isArticleAuthor
                meta {
                  isArticleAuthorUpvoted
                }
                repliesCount
                viewerHasUpvoted
              }
              pageInfo { __typename ... on OffsetPageInfo { totalPages totalCount size page } }

            }
        }
    """
  end

  def q(:one_comment_2) do
    """
    query($comment: CommentPathInput!) {
        oneComment(comment: $comment) {
          innerId
          floor
          body { html }
          viewerHasUpvoted
          emotions {
            type
            count
            viewerHasReacted
          }
        }
      }
    """
  end
end
