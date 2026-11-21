import { graphql } from '~/graphql/authoring'

export const doc = graphql(`
  query Doc($article: ArticlePathInput!) {
    doc(article: $article) {
      ...DocFields
      subtitle
      ...DocDetailFields
    }
  }
`)

export const docPublicTree = graphql(`
  query DocPublicTree($community: String!) {
    docPublicTree(community: $community) {
      tabs {
        ...DocPublicTreeNodeFields
        pins {
          ...DocPublicTreeNodeFields
        }
        groups {
          ...DocPublicTreeGroupFields
        }
      }
    }
  }
`)

export const docPage = graphql(`
  query PagedDocs($pagi: PagiInput, $filter: ArticlePageFilter) {
    docPage(pagi: $pagi, filter: $filter) {
      pinnedEntries {
        ...DocLiteFields
      }
      entries {
        ...DocLiteFields
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
