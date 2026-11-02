import { graphql } from '~/graphql/authoring'
import { changelogPage } from '~/schemas/pages/changelog'
import { postPage } from '~/schemas/pages/post'

export const trashedPosts = graphql(`
  query DashboardTrashedPosts($community: String!, $pagi: PagiInput) {
    trashedArticles(community: $community, thread: POST, pagi: $pagi) {
      entries {
        id
        thread
        articleId
        deletedAt
        scheduledPermanentDeletionAt
        mentionedByCount
        deletedBy {
          ...DashboardAuthorFields
        }
        article {
          innerId
          title
          articleStats {
            views
            viewsRevision
            upvotesCount
            commentsCount
            snapshotAt
          }
          meta {
            thread
          }
          ... on Post {
            cat
            insertedAt
            activeAt
            author {
              ...DashboardAuthorFields
            }
            communityTags {
              ...DashboardTagFields
            }
          }
        }
      }
      pageInfo {
        __typename
        hasNextPage
        hasPreviousPage
        ... on OffsetPageInfo {
          page
          size
          totalCount
          totalPages
        }
        ... on CursorPageInfo {
          startCursor
          endCursor
        }
      }
    }
  }
`)

export const restoreTrashedPost = graphql(`
  mutation restoreTrashedPost($community: String!, $id: ID!, $commandId: ID!) {
    restoreTrashedArticle(community: $community, id: $id, thread: POST, commandId: $commandId) {
      innerId
      title
    }
  }
`)

export const permanentlyDeleteTrashedPost = graphql(`
  mutation permanentlyDeleteTrashedPost($community: String!, $id: ID!, $commandId: ID!) {
    permanentlyDeleteTrashedArticle(
      community: $community
      id: $id
      thread: POST
      commandId: $commandId
    ) {
      done
    }
  }
`)

export default {
  postPage,
  changelogPage,
  trashedPosts,
  restoreTrashedPost,
  permanentlyDeleteTrashedPost,
}
