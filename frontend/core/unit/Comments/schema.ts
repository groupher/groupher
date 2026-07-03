import { gql } from 'urql'

import { F } from '~/schemas'

// viewerHasLiked @include(if: $userHasLogin)
// viewerHasDisliked @include(if: $userHasLogin)

const pagedComments = gql`
  query pagedComments(
    $article: ArticlePathInput!
    $mode: CommentsMode,
    $filter: CommentsFilter!
  ) {
    pagedComments(article: $article, mode: $mode, filter: $filter) {
      entries {
        ${F.comment}
      }
      ${F.pagi}
    }
  }
`

const pagedCommentReplies = gql`
  query($comment: CommentPathInput!, $filter: CommentsFilter!) {
    pagedCommentReplies(comment: $comment, filter: $filter) {
      entries {
        ${F.commentFields}

        replyTo {
          ${F.commentFields}
        }
      }
      ${F.pagi}
    }
  }
`

const createComment = gql`
  mutation ($article: ArticlePathInput!, $body: String!) {
    createComment(article: $article, body: $body) {
      innerId
      bodyHtml
    }
  }
`
const updateComment = gql`
  mutation ($comment: CommentPathInput!, $body: String!) {
    updateComment(comment: $comment, body: $body) {
      innerId
      bodyHtml
      replyTo {
        innerId
      }
    }
  }
`
const commentsState = gql`
  query ($article: ArticlePathInput!, $freshkey: String) {
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
`
const oneComment = gql`
  query ($comment: CommentPathInput!) {
    oneComment(comment: $comment) {
      innerId
      body
    }
  }
`

const replyComment = gql`
  mutation ($comment: CommentPathInput!, $body: String!) {
    replyComment(comment: $comment, body: $body) {
      innerId
      bodyHtml
    }
  }
`
const deleteComment = gql`
  mutation ($comment: CommentPathInput!) {
    deleteComment(comment: $comment) {
      innerId
    }
  }
`

const upvoteComment = gql`
  mutation ($comment: CommentPathInput!) {
    upvoteComment(comment: $comment) {
      innerId
      meta {
        isArticleAuthorUpvoted
      }
      upvotesCount
      viewerHasUpvoted
      replyTo {
        innerId
      }
    }
  }
`
const undoUpvoteComment = gql`
  mutation ($comment: CommentPathInput!) {
    undoUpvoteComment(comment: $comment) {
      innerId
      meta {
        isArticleAuthorUpvoted
      }
      upvotesCount
      viewerHasUpvoted
      replyTo {
        innerId
      }
    }
  }
`
const emotionToComment = gql`
  mutation ($comment: CommentPathInput!, $emotion: CommentEmotion!) {
    emotionToComment(comment: $comment, emotion: $emotion) {
      innerId
      replyTo {
        innerId
      }
      emotions {
        ${F.emotionQuery}
      }
    }
  }
`
const undoEmotionToComment = gql`
  mutation ($comment: CommentPathInput!, $emotion: CommentEmotion!) {
    undoEmotionToComment(comment: $comment, emotion: $emotion) {
      innerId
      replyTo {
        innerId
      }
      emotions {
        ${F.emotionQuery}
      }
    }
  }
`

const searchUsers = gql`
  query($name: String!) {
    searchUsers(name: $name) {
      entries {
        ${F.author}
      }
    }
  }
`

const pagedPublishedComments = gql`
  query pagedPublishedComments(
    $login: String!
    $thread: Thread,
    $filter: PagiFilter!
  ) {
    pagedPublishedComments(login: $login, thread: $thread, filter: $filter) {
      entries {
        ${F.comment}
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
      ${F.pagi}
    }
  }
`

const schema = {
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
  emotionToComment,
  undoEmotionToComment,
  pagedPublishedComments,
}

export default schema
