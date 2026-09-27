import { graphql } from '~/graphql/authoring'

export const articleStats = graphql(`
  query ArticleStats($community: String!, $thread: Thread!, $innerIds: [ID!]!) {
    articleStats(community: $community, thread: $thread, innerIds: $innerIds) {
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
  }
`)
