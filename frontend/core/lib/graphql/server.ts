import { GRAPHQL_ENDPOINT } from '~/config'

/**
 * Sends a server-side GraphQL POST directly to Phoenix.
 *
 * Use this from SSR/RSC data loaders where the request already runs on the
 * server and does not need the browser-facing `/api/graphql` facade. Browser
 * code should use the urql client configured with `/api/graphql` instead.
 *
 * @example
 * ```ts
 * const response = await gqFetch(P.community, {
 *   slug: 'home',
 *   userHasLogin: false,
 * })
 * const payload = await response.json()
 * ```
 */
export const gqFetch = async (
  query: string,
  variables?: Record<string, unknown>,
): Promise<Response> => {
  return await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  })
}
