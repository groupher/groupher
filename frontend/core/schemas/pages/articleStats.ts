import { graphql } from '~/graphql/authoring'

export const articleStatsFields = graphql(`
  fragment ArticleStatsFields on ArticleStats {
    community
    thread
    innerId
    views
    viewsRevision
    upvotesCount
    commentsCount
    collectsCount
    commentsParticipantsCount
    interactionRevision
    commentsRevision
    emotionCounts {
      type
      count
    }
    snapshotAt
  }
`)

export const articleInteractionStateFields = graphql(`
  fragment ArticleInteractionStateFields on ArticleInteractionState {
    community
    thread
    innerId
    interactionRevision
    viewerHasUpvoted
    viewerHasCollected
    viewerEmotion
  }
`)

export const articleStats = graphql(`
  query ArticleStats($community: String!, $thread: Thread!, $innerIds: [ID!]!) {
    articleStats(community: $community, thread: $thread, innerIds: $innerIds) {
      ...ArticleStatsFields
    }
  }
`)
