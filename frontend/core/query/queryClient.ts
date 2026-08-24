import { isServer, QueryClient } from '@tanstack/react-query'

import { GraphQLRequestError } from '~/graphql/client'

const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= 2 || error instanceof GraphQLRequestError) return false
  return error instanceof TypeError
}

/** Creates an isolated QueryClient with Groupher's shared retry and hydration policy. */
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
        shouldDehydrateQuery: (query) => query.state.status === 'success',
      },
    },
  })

let browserQueryClient: QueryClient | undefined

/** Returns a request-local server client or the stable browser QueryClient singleton. */
export const getQueryClient = (): QueryClient => {
  if (isServer) return createQueryClient()
  browserQueryClient ??= createQueryClient()
  return browserQueryClient
}
