import { graphql } from '~/graphql/authoring'

const pagedComments = graphql(`
  query PagedComments($article: ArticlePathInput!, $mode: CommentsMode, $filter: CommentsFilter!) {
    pagedComments(article: $article, mode: $mode, filter: $filter) {
      entries {
        ...CommentFields
        replyToComment {
          ...CommentFields
        }
        replies {
          ...CommentReplyFields
        }
      }
      ...CommentPageFields
    }
  }
`)

const publicPagedComments = graphql(`
  query PublicPagedComments(
    $article: ArticlePathInput!
    $mode: CommentsMode
    $filter: CommentsFilter!
  ) {
    pagedComments(article: $article, mode: $mode, filter: $filter) {
      entries {
        ...CommentPublicFields
        replyToComment {
          ...CommentPublicFields
        }
        replies {
          ...CommentPublicReplyFields
        }
      }
      ...CommentPageFields
    }
  }
`)

const pagedCommentReplies = graphql(`
  query PagedCommentReplies($comment: CommentPathInput!, $filter: CommentsFilter!) {
    pagedCommentReplies(comment: $comment, filter: $filter) {
      entries {
        ...CommentReplyFields
      }
      totalPages
      totalCount
      pageSize
      pageNumber
    }
  }
`)

const createComment = graphql(`
  mutation CreateComment($article: ArticlePathInput!, $body: String!, $commandKey: ID!) {
    createComment(article: $article, body: $body, commandKey: $commandKey) {
      comment {
        ...CommentFields
      }
      article {
        innerId
        commentsCount
        commentsRevision
      }
      commandKey
      commandReplayed
    }
  }
`)

const updateComment = graphql(`
  mutation UpdateComment($comment: CommentPathInput!, $body: String!, $commandKey: ID!) {
    updateComment(comment: $comment, body: $body, commandKey: $commandKey) {
      innerId
      bodyHtml
      replyToComment {
        innerId
      }
      article {
        innerId
        thread
        commentsCount
        commentsRevision
      }
      commandKey
      commandReplayed
    }
  }
`)

const commentsState = graphql(`
  query CommentsState($article: ArticlePathInput!, $freshkey: String) {
    commentsState(article: $article, freshkey: $freshkey) {
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
`)

const oneComment = graphql(`
  query OneComment($comment: CommentPathInput!) {
    oneComment(comment: $comment) {
      body
      ...CommentFields
      article {
        innerId
        commentsCount
        commentsRevision
      }
    }
  }
`)

const reconcileComments = graphql(`
  query ReconcileComments($article: ArticleRefInput!, $commentInnerIds: [ID!]!) {
    commentReconcileStates(article: $article, commentInnerIds: $commentInnerIds) {
      article {
        innerId
        commentsCount
        commentsRevision
      }
      entries {
        commentInnerId
        comment {
          body
          ...CommentFields
          article {
            innerId
            commentsCount
            commentsRevision
          }
        }
      }
    }
  }
`)

const replyComment = graphql(`
  mutation ReplyComment($comment: CommentPathInput!, $body: String!, $commandKey: ID!) {
    replyComment(comment: $comment, body: $body, commandKey: $commandKey) {
      comment {
        ...CommentFields
        replyToComment {
          ...CommentFields
        }
      }
      article {
        innerId
        commentsCount
        commentsRevision
      }
      commandKey
      commandReplayed
    }
  }
`)

const deleteComment = graphql(`
  mutation DeleteComment($comment: CommentPathInput!, $commandKey: ID!) {
    deleteComment(comment: $comment, commandKey: $commandKey) {
      innerId
      commandKey
      commandReplayed
      article {
        thread
        innerId
        commentsCount
        commentsRevision
      }
    }
  }
`)

const upvoteComment = graphql(`
  mutation UpvoteComment($comment: CommentPathInput!, $commandKey: ID!) {
    upvoteComment(comment: $comment, commandKey: $commandKey) {
      innerId
      meta {
        isArticleAuthorUpvoted
      }
      upvotesCount
      commentInteractionRevision
      commandKey
      commandReplayed
      reactionOutcome
      emotions {
        ...CommentEmotionFields
      }
      viewerHasUpvoted
      replyToComment {
        innerId
      }
    }
  }
`)

const undoUpvoteComment = graphql(`
  mutation UndoUpvoteComment($comment: CommentPathInput!, $commandKey: ID!) {
    undoUpvoteComment(comment: $comment, commandKey: $commandKey) {
      innerId
      meta {
        isArticleAuthorUpvoted
      }
      upvotesCount
      commentInteractionRevision
      commandKey
      commandReplayed
      reactionOutcome
      emotions {
        ...CommentEmotionFields
      }
      viewerHasUpvoted
      replyToComment {
        innerId
      }
    }
  }
`)

const reportComment = graphql(`
  mutation ReportComment($comment: CommentPathInput!, $reason: String!, $attr: String) {
    reportComment(comment: $comment, reason: $reason, attr: $attr) {
      innerId
      viewerHasReported
      meta {
        reportedCount
      }
    }
  }
`)

const undoReportComment = graphql(`
  mutation UndoReportComment($comment: CommentPathInput!) {
    undoReportComment(comment: $comment) {
      innerId
      viewerHasReported
      meta {
        reportedCount
      }
    }
  }
`)

const emotionToComment = graphql(`
  mutation EmotionToComment(
    $comment: CommentPathInput!
    $emotion: CommentEmotion!
    $commandKey: ID!
  ) {
    emotionToComment(comment: $comment, emotion: $emotion, commandKey: $commandKey) {
      innerId
      upvotesCount
      viewerHasUpvoted
      commentInteractionRevision
      commandKey
      commandReplayed
      reactionOutcome
      replyToComment {
        innerId
      }
      emotions {
        ...CommentEmotionFields
      }
    }
  }
`)

const undoEmotionToComment = graphql(`
  mutation UndoEmotionToComment(
    $comment: CommentPathInput!
    $emotion: CommentEmotion!
    $commandKey: ID!
  ) {
    undoEmotionToComment(comment: $comment, emotion: $emotion, commandKey: $commandKey) {
      innerId
      upvotesCount
      viewerHasUpvoted
      commentInteractionRevision
      commandKey
      commandReplayed
      reactionOutcome
      replyToComment {
        innerId
      }
      emotions {
        ...CommentEmotionFields
      }
    }
  }
`)

const searchUsers = graphql(`
  query SearchUsers($name: String!) {
    searchUsers(name: $name) {
      entries {
        ...CommentAuthorFields
      }
    }
  }
`)

const pagedPublishedComments = graphql(`
  query PagedPublishedComments($login: String!, $thread: Thread, $filter: PagiFilter!) {
    pagedPublishedComments(login: $login, thread: $thread, filter: $filter) {
      entries {
        ...CommentFields
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
      ...CommentPageFields
    }
  }
`)

export default {
  pagedComments,
  publicPagedComments,
  pagedCommentReplies,
  createComment,
  oneComment,
  reconcileComments,
  commentsState,
  updateComment,
  replyComment,
  deleteComment,
  searchUsers,
  upvoteComment,
  undoUpvoteComment,
  reportComment,
  undoReportComment,
  emotionToComment,
  undoEmotionToComment,
  pagedPublishedComments,
}
