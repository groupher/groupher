import { infiniteQueryOptions } from '@tanstack/react-query'

import { graphql } from '~/graphql/authoring'
import { browserGraphQLRequest } from '~/graphql/client'
import type { ArticlePathInput } from '~/lib/graphql/generated/graphql'
import { viewerQueryKeys } from '~/query/key'

export const articleActivityPage = graphql(`
  query ArticleLogsPage($article: ArticlePathInput!, $pagi: PagiInput) {
    articleLogs(article: $article, pagi: $pagi) {
      entries {
        id
        action
        actor {
          type
          login
          nickname
          avatar
        }
        subject {
          type
          title
          innerId
        }
        target {
          type
          ref
          title
          innerId
          url
        }
        payload
        occurredAt
      }
      pageInfo {
        __typename
        ... on CursorPageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  }
`)

export const articleActivityQueries = {
  key: (article: ArticlePathInput, accountScope: string | null) =>
    [...viewerQueryKeys.all, accountScope || 'anonymous', 'article-activity', article] as const,
  pages: (article: ArticlePathInput, accountScope: string | null) =>
    infiniteQueryOptions({
      queryKey: articleActivityQueries.key(article, accountScope),
      initialPageParam: null as string | null,
      queryFn: async ({ pageParam, signal }) =>
        (
          await browserGraphQLRequest(
            articleActivityPage,
            {
              article,
              pagi: { cursor: { first: 20, after: pageParam } },
            },
            { signal },
          )
        ).articleLogs,
      getNextPageParam: (page) =>
        page.pageInfo.__typename === 'CursorPageInfo' && page.pageInfo.hasNextPage
          ? page.pageInfo.endCursor
          : undefined,
    }),
}
