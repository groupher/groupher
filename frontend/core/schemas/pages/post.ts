import { graphql } from '~/graphql/authoring'

export const post = graphql(`
  query Post($article: ArticlePathInput!) {
    post(article: $article) {
      ...PagePostFields
      ...PagePostDetailFields
    }
  }
`)

export const pagedPublishedPosts = graphql(`
  query PagedPublishedPosts($login: String!, $filter: ArticlePageFilter, $pagi: PagiInput) {
    pagedPublishedPosts(login: $login, filter: $filter, pagi: $pagi) {
      pinnedEntries {
        ...PagePostLiteFields
      }
      entries {
        ...PagePostLiteFields
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

export const postPage = graphql(`
  query PostPage($pagi: PagiInput, $filter: PostFilter, $thread: PostThread = POST) {
    postPage(pagi: $pagi, filter: $filter, thread: $thread) {
      pinnedEntries {
        ...PagePostLiteFields
      }
      entries {
        ...PagePostLiteFields
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
