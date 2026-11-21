import { graphql } from '~/graphql/authoring'

const commentPage = graphql(`
  "Comment Lite page using the shared offset/cursor pagination contract"
  query PagedComments(
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
        ...CommentPageInfo
      }
    }
  }
`)

const commentReplyPage = graphql(`
  "A root comment's flat descendants through the shared Pagi contract"
  query PagedCommentReplies(
    $comment: CommentPathInput!
    $filter: CommentPageFilter
    $pagi: PagiInput
  ) {
    commentReplyPage(comment: $comment, filter: $filter, pagi: $pagi) {
      entries {
        ...CommentPublicReplyFields
      }
      pageInfo {
        ...CommentPageInfo
      }
    }
  }
`)

const createComment = graphql(`
  "Write a comment"
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
  "Update a comment"
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
  "Got basic comments state"
  query CommentsState($article: ArticlePathInput!, $freshkey: String) {
    commentsState(article: $article, freshkey: $freshkey) {
      totalCount
      participantsCount
      participants {
        ref
        login
        nickname
        avatar
      }
    }
  }
`)

const oneComment = graphql(`
  "Got spec comment by ref"
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
  "Reads up to 100 Comment projections for confirmed-write reconciliation in one request"
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
  "Reply to a comment"
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
  "Delete a comment"
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
  "Upvote to a comment"
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
  "Undo upvote to a comment"
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
  "Emotion to a comment"
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
  "Undo emotion to a comment"
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
  "Search user by name"
  query SearchUsers($name: String!) {
    searchUsers(name: $name) {
      ...UserSearchFields
    }
  }
`)

const pagedPublishedComments = graphql(`
  "Get paged published article comments"
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
          community {
            slug
          }
          author {
            nickname
            login
          }
        }
      }
      pageInfo {
        ...CommentPageInfo
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
