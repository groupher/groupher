import { graphql } from '~/graphql/authoring'

const commentPage = graphql(`
  query CommentPage(
    $article: ArticlePathInput!
    $mode: CommentsMode
    $filter: CommentPageFilter
    $pagi: PagiInput
  ) {
    commentPage(article: $article, mode: $mode, filter: $filter, pagi: $pagi) {
      entries {
        ...CommentPublicFields
        replyToComment {
          ...CommentPublicFields
        }
        replies {
          ...CommentPublicReplyFields
        }
      }
      pinnedEntries {
        ...CommentPublicFields
        replyToComment {
          ...CommentPublicFields
        }
        replies {
          ...CommentPublicReplyFields
        }
      }
      pageInfo {
        ...CommentPagiInfo
      }
    }
  }
`)

const commentReplyPage = graphql(`
  query CommentReplyPage(
    $comment: CommentPathInput!
    $filter: CommentPageFilter
    $pagi: PagiInput
  ) {
    commentReplyPage(comment: $comment, filter: $filter, pagi: $pagi) {
      entries {
        ...CommentPublicReplyFields
      }
      pageInfo {
        ...CommentPagiInfo
      }
    }
  }
`)

const createComment = graphql(`
  mutation CreateComment(
    $article: ArticlePathInput!
    $bodyBag: ArtimentBodyBagInput!
    $commandId: ID!
  ) {
    createComment(article: $article, bodyBag: $bodyBag, commandId: $commandId) {
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
  mutation UpdateComment(
    $comment: CommentPathInput!
    $bodyBag: ArtimentBodyBagInput!
    $expectedVersion: Int!
    $commandId: ID!
  ) {
    updateComment(
      comment: $comment
      bodyBag: $bodyBag
      expectedVersion: $expectedVersion
      commandId: $commandId
    ) {
      commandId
      comment {
        innerId
        body {
          html
        }
        bodyVersion
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
  mutation ReplyComment(
    $comment: CommentPathInput!
    $bodyBag: ArtimentBodyBagInput!
    $commandId: ID!
  ) {
    replyComment(comment: $comment, bodyBag: $bodyBag, commandId: $commandId) {
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
      ...CommentAuthorFields
    }
  }
`)

const pagedPublishedComments = graphql(`
  query PagedPublishedComments(
    $login: String!
    $thread: Thread
    $filter: CommentPageFilter
    $pagi: PagiInput
  ) {
    pagedPublishedComments(login: $login, thread: $thread, filter: $filter, pagi: $pagi) {
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
      pageInfo {
        ...CommentPagiInfo
      }
    }
  }
`)

export default {
  commentPage,
  commentReplyPage,
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
  emotionToComment,
  undoEmotionToComment,
  pagedPublishedComments,
}
