import { graphql } from '~/graphql/authoring'
import { changelogPage } from '~/schemas/pages/changelog'
import { postPage } from '~/schemas/pages/post'

export const trashedPosts = graphql(`
  "Current Article Trash memberships"
  query DashboardTrashedPosts($community: String!, $thread: Thread!, $pagi: PagiInput) {
    trashedArticles(community: $community, thread: $thread, pagi: $pagi) {
      entries {
        id
        thread
        articleId
        deletedAt
        scheduledPermanentDeletionAt
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
  "Restore one logical Article from Trash"
  mutation restoreTrashedPost($community: String!, $id: ID!, $thread: Thread!, $commandId: ID!) {
    restoreTrashedArticle(community: $community, id: $id, thread: $thread, commandId: $commandId) {
      innerId
      title
    }
  }
`)

export const permanentlyDeleteTrashedPost = graphql(`
  "Permanently delete one standalone Article aggregate from Trash"
  mutation permanentlyDeleteTrashedPost(
    $community: String!
    $id: ID!
    $thread: Thread!
    $commandId: ID!
  ) {
    permanentlyDeleteTrashedArticle(
      community: $community
      id: $id
      thread: $thread
      commandId: $commandId
    ) {
      done
    }
  }
`)

export const hideCommunityArticle = graphql(`
  "Hide one Article from this Community without deleting the Article"
  mutation hideCommunityArticle(
    $communityRef: String!
    $thread: CommunityArticleTrashThread!
    $articleId: ID!
    $commandId: ID!
  ) {
    hideCommunityArticle(
      communityRef: $communityRef
      thread: $thread
      articleId: $articleId
      commandId: $commandId
    ) {
      articleId
      hiddenAt
      recordRevision
    }
  }
`)

export default {
  postPage,
  changelogPage,
  trashedPosts,
  restoreTrashedPost,
  permanentlyDeleteTrashedPost,
  hideCommunityArticle,
}
