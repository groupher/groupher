import { graphql } from '~/graphql/authoring'
import { pagedChangelogs } from '~/schemas/pages/changelog'
import { pagedPosts } from '~/schemas/pages/post'

export const trashedPosts = graphql(`
  query DashboardTrashedPosts($community: String!, $page: Int!, $size: Int!) {
    trashedArticles(community: $community, thread: POST, filter: { page: $page, size: $size }) {
      entries {
        id
        thread
        articleRef
        deletedAt
        scheduledPermanentDeletionAt
        mentionedByCount
        deletedBy {
          ...DashboardAuthorFields
        }
        article {
          innerId
          title
          views
          upvotesCount
          meta {
            thread
          }
          ... on Post {
            cat
            status
            commentsCount
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
      ...DashboardTrashedArticlesPageInfo
    }
  }
`)

export const restoreTrashedPost = graphql(`
  mutation restoreTrashedPost($community: String!, $id: ID!) {
    restoreTrashedArticle(community: $community, id: $id, thread: POST) {
      innerId
      title
    }
  }
`)

export const permanentlyDeleteTrashedPost = graphql(`
  mutation permanentlyDeleteTrashedPost($community: String!, $id: ID!) {
    permanentlyDeleteTrashedArticle(community: $community, id: $id, thread: POST) {
      done
    }
  }
`)

export default {
  pagedPosts,
  pagedChangelogs,
  trashedPosts,
  restoreTrashedPost,
  permanentlyDeleteTrashedPost,
}
