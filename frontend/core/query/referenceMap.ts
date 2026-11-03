import { queryOptions } from '@tanstack/react-query'

import { graphql } from '~/graphql/authoring'
import { browserGraphQLRequest } from '~/graphql/client'
import type { ReferenceMapLocatorInput } from '~/lib/graphql/generated/graphql'

export const referenceMapPage = graphql(`
  query ReferenceMapPage(
    $community: String!
    $focus: ReferenceMapLocatorInput!
    $frontiers: [ReferenceMapFrontierInput!]!
    $first: Int
  ) {
    referenceMap(community: $community, focus: $focus, frontiers: $frontiers, first: $first) {
      nodes {
        id
        type
        articleInnerId
        commentInnerId
        branchId
        title
        url
        syncState
      }
      edges {
        id
        from
        to
        occurrencesCount
      }
      neighborhoods {
        requestIndex
        state
        nodeId
        edgeIds
        hasNextPage
        endCursor
      }
      projectionPending
    }
  }
`)

export const referenceMapRevision = graphql(`
  query ReferenceMapRevision($community: String!, $focus: ReferenceMapLocatorInput!) {
    referenceMapRevision(community: $community, focus: $focus)
  }
`)

export const referenceMapArticleComments = graphql(`
  query ReferenceMapArticleComments(
    $community: String!
    $focus: ReferenceMapLocatorInput!
    $after: ID
    $first: Int
  ) {
    referenceMapArticleComments(
      community: $community
      focus: $focus
      after: $after
      first: $first
    ) {
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

export type ReferenceMapFocus = ReferenceMapLocatorInput
export type ReferenceMapFrontier = { node: ReferenceMapFocus; after?: string | null }

export const referenceMapQueries = {
  key: (community: string) => ['reference-map', community, 'public-current'] as const,
  page: (
    community: string,
    focus: ReferenceMapFocus,
    frontiers: ReferenceMapFrontier[],
    first = 20,
  ) =>
    queryOptions({
      queryKey: [...referenceMapQueries.key(community), focus, frontiers, first] as const,
      queryFn: async () =>
        (await browserGraphQLRequest(referenceMapPage, { community, focus, frontiers, first }))
          .referenceMap,
    }),
  revision: (community: string, focus: ReferenceMapFocus) =>
    queryOptions({
      queryKey: [...referenceMapQueries.key(community), focus, 'revision'] as const,
      queryFn: async () =>
        (await browserGraphQLRequest(referenceMapRevision, { community, focus }))
          .referenceMapRevision,
    }),
  articleComments: (community: string, focus: ReferenceMapFocus, after?: string | null) =>
    queryOptions({
      queryKey: [...referenceMapQueries.key(community), focus, 'article-comments', after] as const,
      queryFn: async () =>
        (
          await browserGraphQLRequest(referenceMapArticleComments, {
            community,
            focus,
            after,
            first: 20,
          })
        ).referenceMapArticleComments,
    }),
}
