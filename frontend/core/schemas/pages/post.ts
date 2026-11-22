import { graphql } from '~/graphql/authoring'

export const post = graphql(`
  "Get post by id"
  query Post($article: ArticlePathInput!) {
    post(article: $article) {
      ...PostFields
      ...PostDetailFields
    }
  }
`)

export const pagedPublishedPosts = graphql(`
  "Paged published posts"
  query PagedPublishedPosts($login: String!, $filter: ArticlePageFilter, $pagi: PagiInput) {
    pagedPublishedPosts(login: $login, filter: $filter, pagi: $pagi) {
      pinnedEntries {
        ...PostLiteFields
      }
      entries {
        ...PostLiteFields
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
  "Article Lite page using the shared offset/cursor pagination contract"
  query PagedPosts($pagi: PagiInput, $filter: PostFilter, $thread: PostThread = POST) {
    postPage(pagi: $pagi, filter: $filter, thread: $thread) {
      pinnedEntries {
        ...PostLiteFields
      }
      entries {
        ...PostLiteFields
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
