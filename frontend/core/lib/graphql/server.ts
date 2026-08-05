import { print, type DocumentNode } from 'graphql'
import { headers } from 'next/headers'

import { getPhoenixToken } from '~/app/phoenix-token'
import { GRAPHQL_ENDPOINT } from '~/config'

const schemaToString = (schema: string | DocumentNode): string => {
  if (typeof schema === 'string') return schema

  return print(schema)
}

/**
 * Sends a server-side GraphQL POST to Phoenix.
 *
 * Server-side calls use the current request cookies when available, verify the
 * Phoenix token, and forward it as `Authorization: Bearer <token>`. Requests
 * without a valid auth cookie remain anonymous. Browser code should use the urql
 * client configured with `/api/graphql` instead.
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
  query: string | DocumentNode,
  variables?: Record<string, unknown>,
): Promise<Response> => {
  const headerStore = await headers()
  const token = getPhoenixToken(
    new Request('https://groupher.local/graphql', { headers: headerStore }),
  )

  return await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      query: schemaToString(query),
      variables,
    }),
  })
}
