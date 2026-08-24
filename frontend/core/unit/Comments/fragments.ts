import { graphql } from '~/graphql/authoring'

export const CommentAuthorFields = graphql(`
  fragment CommentAuthorFields on User {
    login
    nickname
    avatar
    bio
    shortbio
  }
`)

export const CommentEmotionFields = graphql(`
  fragment CommentEmotionFields on EmotionStat {
    type
    count
    viewerHasReacted
    latestUsers {
      login
      nickname
      avatar
    }
  }
`)

export const CommentMetaFields = graphql(`
  fragment CommentMetaFields on CommentMeta {
    isLegal
    illegalReason
    illegalWords
    isArticleAuthorUpvoted
    isReplyToOthers
  }
`)

export const CommentFields = graphql(`
  fragment CommentFields on Comment {
    innerId
    bodyHtml
    author {
      ...CommentAuthorFields
    }
    meta {
      ...CommentMetaFields
    }
    emotions {
      ...CommentEmotionFields
    }
    isPinned
    isSolution
    floor
    upvotesCount
    isArticleAuthor
    viewerHasUpvoted
    viewerHasReported
    repliesCount
    insertedAt
    updatedAt
  }
`)

export const CommentReplyFields = graphql(`
  fragment CommentReplyFields on CommentReply {
    innerId
    bodyHtml
    author {
      ...CommentAuthorFields
    }
    meta {
      ...CommentMetaFields
    }
    emotions {
      ...CommentEmotionFields
    }
    isPinned
    isSolution
    floor
    upvotesCount
    isArticleAuthor
    viewerHasUpvoted
    viewerHasReported
    repliesCount
    insertedAt
    updatedAt
    replyToComment {
      ...CommentFields
    }
  }
`)

export const CommentPageFields = graphql(`
  fragment CommentPageFields on PagedComments {
    totalPages
    totalCount
    pageSize
    pageNumber
  }
`)
