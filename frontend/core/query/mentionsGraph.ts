import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import { graphql } from '~/graphql/authoring'
import { browserGraphQLRequest } from '~/graphql/client'
import type { MentionsGraphLocatorInput } from '~/lib/graphql/generated/graphql'

import { readMentionsGraphWithRestart } from './mentionsGraphRecovery'

export const mentionsGraphPage = graphql(`
  query MentionsGraphPage(
    $community: String!
    $focus: MentionsGraphLocatorInput!
    $after: String
    $first: Int
  ) {
    mentionsGraph(community: $community, focus: $focus, after: $after, first: $first) {
      revision
      nodes {
        id
        type
        status
        title
        url
        locator {
          type
          articleInnerId
          articleId
          commentInnerId
        }
        canOpen
      }
      edges {
        id
        from
        to
        occurrencesCount
      }
      hasNextPage
      endCursor
    }
  }
`)

export const mentionsGraphArticleComments = graphql(`
  query MentionsGraphArticleComments(
    $community: String!
    $focus: MentionsGraphLocatorInput!
    $after: ID
    $first: Int
  ) {
    mentionsGraphArticleComments(
      community: $community
      focus: $focus
      after: $after
      first: $first
    ) {
      revision
      comments {
        type
        articleInnerId
        commentInnerId
      }
      hasNextPage
      endCursor
    }
  }
`)

export const mentionsGraphRevision = graphql(`
  query MentionsGraphRevision($community: String!, $focus: MentionsGraphLocatorInput!) {
    mentionsGraphRevision(community: $community, focus: $focus)
  }
`)

export type MentionsGraphFocus = MentionsGraphLocatorInput

/** Keys a resource locator, including the parent identity and public Comment inner ID. */
export const mentionsGraphLocatorKey = (locator: MentionsGraphFocus): string =>
  `${locator.type}:${locator.articleId ? `id:${locator.articleId}` : `inner:${locator.articleInnerId}`}:${locator.commentInnerId ?? ''}`

export const mentionsGraphQueries = {
  key: (community: string) => ['mentions-graph', community, 'public-current'] as const,
  revisionKey: (community: string, focus: MentionsGraphFocus) =>
    ['mentions-graph-revision', community, focus] as const,
  articleCommentsKey: (community: string, focus: MentionsGraphFocus) =>
    [...mentionsGraphQueries.key(community), 'article-comments', focus] as const,
  revision: (community: string, focus: MentionsGraphFocus) =>
    queryOptions({
      queryKey: mentionsGraphQueries.revisionKey(community, focus),
      queryFn: async ({ signal }) =>
        (await browserGraphQLRequest(mentionsGraphRevision, { community, focus }, { signal }))
          .mentionsGraphRevision,
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
      refetchOnMount: 'always',
      refetchOnWindowFocus: 'always',
      staleTime: 0,
    }),
  page: (community: string, focus: MentionsGraphFocus) =>
    infiniteQueryOptions({
      queryKey: [...mentionsGraphQueries.key(community), focus, 'page'] as const,
      initialPageParam: null as string | null,
      staleTime: 30_000,
      queryFn: async ({ pageParam, signal }) =>
        readMentionsGraphWithRestart(
          async () =>
            (
              await browserGraphQLRequest(
                mentionsGraphPage,
                { community, focus, after: pageParam, first: 20 },
                { signal },
              )
            ).mentionsGraph,
          !!pageParam,
          signal,
        ),
      getNextPageParam: (page) => (page.hasNextPage ? (page.endCursor ?? undefined) : undefined),
    }),
  articleComments: (community: string, focus: MentionsGraphFocus) =>
    infiniteQueryOptions({
      queryKey: mentionsGraphQueries.articleCommentsKey(community, focus),
      initialPageParam: null as string | null,
      queryFn: async ({ pageParam, signal }) =>
        (
          await browserGraphQLRequest(
            mentionsGraphArticleComments,
            { community, focus, after: pageParam, first: 20 },
            { signal },
          )
        ).mentionsGraphArticleComments,
      getNextPageParam: (page) => (page.hasNextPage ? (page.endCursor ?? undefined) : undefined),
    }),
}
