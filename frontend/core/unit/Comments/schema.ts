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
  mutation CreateComment($article: ArticlePathInput!, $body: String!, $commandId: ID!) {
    createComment(article: $article, body: $body, commandId: $commandId) {
      commandId
      comment {
        ...CommentFields
      }
      articleStats {
        ...ArticleStatsFields
      }
    }
  }
`)

const updateComment = graphql(`
  mutation UpdateComment($comment: CommentPathInput!, $body: String!, $commandId: ID!) {
    updateComment(comment: $comment, body: $body, commandId: $commandId) {
      commandId
      comment {
        innerId
        bodyHtml
        replyToComment {
          innerId
        }
      }
      articleStats {
        ...ArticleStatsFields
      }
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
        commentsRevision
      }
    }
  }
`)

const reconcileComments = graphql(`
  query ReconcileComments($article: ArticlePathInput!, $commentInnerIds: [ID!]!) {
    commentReconcileStates(article: $article, commentInnerIds: $commentInnerIds) {
      article {
        innerId
        commentsRevision
      }
      entries {
        commentInnerId
        comment {
          body
          ...CommentFields
          article {
            innerId
            commentsRevision
          }
        }
      }
    }
  }
`)

const replyComment = graphql(`
  mutation ReplyComment($comment: CommentPathInput!, $body: String!, $commandId: ID!) {
    replyComment(comment: $comment, body: $body, commandId: $commandId) {
      commandId
      comment {
        ...CommentFields
        replyToComment {
          ...CommentFields
        }
      }
      articleStats {
        ...ArticleStatsFields
      }
    }
  }
`)

const deleteComment = graphql(`
  mutation DeleteComment($comment: CommentPathInput!, $commandId: ID!) {
    deleteComment(comment: $comment, commandId: $commandId) {
      commandId
      comment {
        innerId
      }
      articleStats {
        ...ArticleStatsFields
      }
    }
  }
`)

const upvoteComment = graphql(`
  mutation UpvoteComment($comment: CommentPathInput!, $commandId: ID!) {
    upvoteComment(comment: $comment, commandId: $commandId) {
      innerId
      meta {
        isArticleAuthorUpvoted
      }
      upvotesCount
      commentInteractionRevision
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
  mutation UndoUpvoteComment($comment: CommentPathInput!, $commandId: ID!) {
    undoUpvoteComment(comment: $comment, commandId: $commandId) {
      innerId
      meta {
        isArticleAuthorUpvoted
      }
      upvotesCount
      commentInteractionRevision
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
    $commandId: ID!
  ) {
    emotionToComment(comment: $comment, emotion: $emotion, commandId: $commandId) {
      innerId
      upvotesCount
      viewerHasUpvoted
      commentInteractionRevision
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
    $commandId: ID!
  ) {
    undoEmotionToComment(comment: $comment, emotion: $emotion, commandId: $commandId) {
      innerId
      upvotesCount
      viewerHasUpvoted
      commentInteractionRevision
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
