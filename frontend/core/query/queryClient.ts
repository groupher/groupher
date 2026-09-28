/**
 * Creates the shared TanStack Query runtime and its transport/hydration policy.
 *
 *   browser/server request
 *     -> createQueryClient
 *     -> bounded transport retry + public-only dehydration
 *     -> feature query modules
 *
 * GraphQL/domain errors never retry, mutations never retry automatically, and private viewer data
 * is excluded from hydration by requiring an explicit public metadata marker.
 */
import { isServer, QueryClient } from '@tanstack/react-query'

import { GraphQLRequestError } from '~/graphql/client'

/** Distinguishes retryable network transport failures from deterministic GraphQL/domain errors. */
export const isRetryableTransportError = (error: unknown): boolean => error instanceof TypeError

const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= 2 || error instanceof GraphQLRequestError) return false
  return isRetryableTransportError(error)
}

/** Creates one isolated QueryClient with bounded retries and public-only dehydration. */
export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: shouldRetry,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          query.state.status === 'success' && query.meta?.hydration === 'public',
        shouldDehydrateMutation: () => false,
      },
    },
  })

type QueryClientGlobal = typeof globalThis & {
  __GROUPHER_QUERY_CLIENT__?: QueryClient
}

/** Returns a request-local server client or the stable browser QueryClient singleton. */
export const getQueryClient = (): QueryClient => {
  if (isServer) return createQueryClient()

  const globalScope = globalThis as QueryClientGlobal
  globalScope.__GROUPHER_QUERY_CLIENT__ ??= createQueryClient()
  return globalScope.__GROUPHER_QUERY_CLIENT__
}
