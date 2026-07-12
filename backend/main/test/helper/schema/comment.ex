defmodule GroupherServer.Test.Helper.Schema.Comment do
  @moduledoc "GraphQL documents used by comment tests."

  def m(:create_comment_2) do
    """
    mutation($article: ArticlePathInput!, $body: String!) {
          createComment(article: $article, body: $body) {
            innerId
            bodyHtml
          }
        }
    """
  end

  def m(:undo_mark_comment_solution) do
    """
    mutation($comment: CommentPathInput!) {
          undoMarkCommentSolution(comment: $comment) {
            innerId
            isForQuestion
            isSolution
          }
        }
    """
  end

  def m(:create_comment) do
    """
    mutation($article: ArticlePathInput!, $body: String!) {
      createComment(article: $article, body: $body) {
        innerId
        bodyHtml
      }
    }
    """
  end

  def m(:update_comment) do
    """
    mutation($comment: CommentPathInput!, $body: String!) {
      updateComment(comment: $comment, body: $body) {
        innerId
        bodyHtml
      }
    }
    """
  end

  def m(:delete_comment) do
    """
    mutation($comment: CommentPathInput!) {
      deleteComment(comment: $comment) {
        innerId
        isDeleted
      }
    }
    """
  end

  def m(:reply_comment) do
    """
    mutation($comment: CommentPathInput!, $body: String!) {
      replyComment(comment: $comment, body: $body) {
        innerId
        bodyHtml
      }
    }
    """
  end

  def m(:upvote_comment) do
    """
    mutation($comment: CommentPathInput!) {
      upvoteComment(comment: $comment) {
        innerId
        upvotesCount
        viewerHasUpvoted
      }
    }
    """
  end

  def m(:undo_upvote_comment) do
    """
    mutation($comment: CommentPathInput!) {
      undoUpvoteComment(comment: $comment) {
        innerId
        upvotesCount
        viewerHasUpvoted
      }
    }
    """
  end

  def m(:report_comment) do
    """
    mutation($comment: CommentPathInput!, $reason: String!, $attr: String) {
      reportComment(comment: $comment, reason: $reason, attr: $attr) {
        innerId
        viewerHasReported
        meta {
          reportedCount
        }
      }
    }
    """
  end

  def m(:undo_report_comment) do
    """
    mutation($comment: CommentPathInput!) {
      undoReportComment(comment: $comment) {
        innerId
        viewerHasReported
        meta {
          reportedCount
        }
      }
    }
    """
  end

  def m(:pin_comment) do
    """
    mutation($comment: CommentPathInput!){
      pinComment(comment: $comment) {
        innerId
        isPinned
      }
    }
    """
  end

  def m(:undo_pin_comment) do
    """
    mutation($comment: CommentPathInput!){
      undoPinComment(comment: $comment) {
        innerId
        isPinned
      }
    }
    """
  end

  def m(:emotion_to_comment) do
    """
    mutation($comment: CommentPathInput!, $emotion: CommentEmotion!) {
      emotionToComment(comment: $comment, emotion: $emotion) {
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
    mutation($comment: CommentPathInput!, $emotion: CommentEmotion!) {
      undoEmotionToComment(comment: $comment, emotion: $emotion) {
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

  def m(:mark_comment_solution) do
    """
    mutation($comment: CommentPathInput!) {
          markCommentSolution(comment: $comment) {
            innerId
            isForQuestion
            isSolution
          }
        }
    """
  end

  def q(:paged_published_comments) do
    """
    query($login: String!, $thread: Thread, $filter: PagiFilter!) {
      pagedPublishedComments(login: $login, thread: $thread, filter: $filter) {
        entries {
          innerId
          bodyHtml
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
        totalPages
        totalCount
        pageSize
        pageNumber
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
          body
          isArchived
          archivedAt
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

  def q(:paged_comments) do
    """
    query($article: ArticlePathInput!, $mode: CommentsMode, $filter: CommentsFilter!) {
            pagedComments(article: $article, mode: $mode, filter: $filter) {
              entries {
                innerId
                bodyHtml
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
                  isLegal
                  illegalReason
                  illegalWords
                }
                replyToComment {
                  innerId
                  bodyHtml
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
                  bodyHtml
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
              totalPages
              totalCount
              pageSize
              pageNumber
            }
        }
    """
  end

  def q(:paged_comments_participants) do
    """
    query($article: ArticlePathInput!, $filter: PagiFilter!) {
            pagedCommentsParticipants(article: $article, filter: $filter) {
              entries {
                login
                nickname
              }
              totalPages
              totalCount
              pageSize
              pageNumber
            }
        }
    """
  end

  def q(:paged_comment_replies) do
    """
    query($comment: CommentPathInput!, $filter: CommentsFilter!) {
            pagedCommentReplies(comment: $comment, filter: $filter) {
              entries {
                innerId
                bodyHtml
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
              totalPages
              totalCount
              pageSize
              pageNumber
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
          body
          isArchived
          archivedAt
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
