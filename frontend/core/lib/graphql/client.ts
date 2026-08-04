import type { CombinedError } from 'urql'

/**
 * Browser-side fetch options shared by urql clients and imperative GraphQL
 * calls. Browser code always talks to the same-origin `/api/graphql` facade;
 * cookies are still included so the Next route handler can read the Groupher
 * auth token and forward it to Phoenix.
 *
 * @example
 * ```ts
 * createClient({
 *   url: '/api/graphql',
 *   fetchOptions: GRAPHQL_FETCH_OPTIONS,
 * })
 * ```
 */
export const GRAPHQL_FETCH_OPTIONS = (): RequestInit => ({
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Retry policy for browser GraphQL clients.
 *
 * Only network errors are retried. GraphQL validation and business errors must
 * be returned to callers unchanged so UI code can render the exact failure.
 *
 * @example
 * ```ts
 * createClient({
 *   exchanges: [cacheExchange, retryExchange(GRAPHQL_RETRY_OPTIONS), fetchExchange],
 * })
 * ```
 */
export const GRAPHQL_RETRY_OPTIONS = {
  initialDelayMs: 1000,
  maxDelayMs: 15000,
  randomDelay: true,
  maxNumberAttempts: 2,
  retryIf: (err: CombinedError | undefined) => !!err?.networkError,
}
