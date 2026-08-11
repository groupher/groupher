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
  mutation CreateComment($article: ArticlePathInput!, $body: String!) {
    createComment(article: $article, body: $body) {
      innerId
      bodyHtml
    }
  }
`)

const updateComment = graphql(`
  mutation UpdateComment($comment: CommentPathInput!, $body: String!) {
    updateComment(comment: $comment, body: $body) {
      innerId
      bodyHtml
      replyToComment {
        innerId
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
      innerId
      body
    }
  }
`)

const replyComment = graphql(`
  mutation ReplyComment($comment: CommentPathInput!, $body: String!) {
    replyComment(comment: $comment, body: $body) {
      innerId
      bodyHtml
    }
  }
`)

const deleteComment = graphql(`
  mutation DeleteComment($comment: CommentPathInput!) {
    deleteComment(comment: $comment) {
      innerId
    }
  }
`)

const upvoteComment = graphql(`
  mutation UpvoteComment($comment: CommentPathInput!) {
    upvoteComment(comment: $comment) {
      innerId
      meta {
        isArticleAuthorUpvoted
      }
      upvotesCount
      viewerHasUpvoted
      replyToComment {
        innerId
      }
    }
  }
`)

const undoUpvoteComment = graphql(`
  mutation UndoUpvoteComment($comment: CommentPathInput!) {
    undoUpvoteComment(comment: $comment) {
      innerId
      meta {
        isArticleAuthorUpvoted
      }
      upvotesCount
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
  mutation EmotionToComment($comment: CommentPathInput!, $emotion: CommentEmotion!) {
    emotionToComment(comment: $comment, emotion: $emotion) {
      innerId
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
  mutation UndoEmotionToComment($comment: CommentPathInput!, $emotion: CommentEmotion!) {
    undoEmotionToComment(comment: $comment, emotion: $emotion) {
      innerId
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
  pagedCommentReplies,
  createComment,
  oneComment,
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
