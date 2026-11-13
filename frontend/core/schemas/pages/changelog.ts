import { graphql } from '~/graphql/authoring'

export const changelog = graphql(`
  "Get changelog by id"
  query Changelog($article: ArticlePathInput!) {
    changelog(article: $article) {
      ...ChangelogFields
      ...ChangelogDetailFields
    }
  }
`)

export const changelogPage = graphql(`
  "Changelog Lite page using the shared offset/cursor pagination contract"
  query ChangelogPage(
    $pagi: PagiInput
    $filter: ChangelogFilter
    $thread: ChangelogThread = CHANGELOG
  ) {
    changelogPage(pagi: $pagi, filter: $filter, thread: $thread) {
      pinnedEntries {
        ...ChangelogLiteFields
      }
      entries {
        ...ChangelogLiteFields
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
