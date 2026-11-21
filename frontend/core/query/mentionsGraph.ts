import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import { graphql } from '~/graphql/authoring'
import { browserGraphQLRequest } from '~/graphql/client'
import type { MentionsGraphLocatorInput } from '~/lib/graphql/generated/graphql'

import { readMentionsGraphWithRestart } from './mentionsGraphRecovery'

export const mentionsGraphPage = graphql(`
  "Pages mention relationships around a focused resource in a community."
  query PagedMentionsGraph(
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
  "Pages article comments associated with a focused mention graph resource."
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
  "Reads the revision of the mention graph around a focused resource."
  query MentionsGraphRevision($community: String!, $focus: MentionsGraphLocatorInput!) {
    mentionsGraphRevision(community: $community, focus: $focus)
  }
`)

export type MentionsGraphFocus = MentionsGraphLocatorInput

/** Keys a resource locator, including the parent identity and public Comment inner ID. */
export const mentionsGraphLocatorKey = (locator: MentionsGraphFocus): string =>
  `${locator.type}:${locator.articleId ? `id:${locator.articleId}` : `inner:${locator.articleInnerId}`}:${locator.commentInnerId ?? ''}`

export const mentionsGraphKeys = {
  all: ['mentions-graph'] as const,
  revision: (community: string, focus: MentionsGraphFocus) =>
    [...mentionsGraphKeys.all, community, 'revision', focus] as const,
  page: (community: string, focus: MentionsGraphFocus) =>
    [...mentionsGraphKeys.all, community, 'page', focus] as const,
  articleComments: (community: string, focus: MentionsGraphFocus) =>
    [...mentionsGraphKeys.all, community, 'article-comments', focus] as const,
}

export const mentionsGraphQueries = {
  revision: (community: string, focus: MentionsGraphFocus) =>
    queryOptions({
      queryKey: mentionsGraphKeys.revision(community, focus),
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
      queryKey: mentionsGraphKeys.page(community, focus),
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
      queryKey: mentionsGraphKeys.articleComments(community, focus),
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
