import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { GROUPHER_AUTH_TOKEN_COOKIE } from '@groupher/contracts/auth'
import { getRequest, setResponseHeader } from '@tanstack/react-start/server'
import { print } from 'graphql'

export type GraphQLResponse<T> = {
  data?: T
  errors?: Array<{ extensions?: { code?: unknown; reasonCode?: unknown }; message?: string }>
}

export class GraphQLRequestError extends Error {
  reasonCode?: string

  constructor(message: string, reasonCode?: string) {
    super(message)
    this.name = 'GraphQLRequestError'
    this.reasonCode = reasonCode
  }
}

const readToken = (cookieHeader: string | null): string | null => {
  for (const part of cookieHeader?.split(';') ?? []) {
    const [name, ...value] = part.trim().split('=')
    if (name === GROUPHER_AUTH_TOKEN_COOKIE) return value.join('=')
  }
  return null
}

/** Runs the request graph ql operation at the frontend shared boundary. */
export const requestGraphQL = async <TData, TVariables extends object>(
  query: TypedDocumentNode<TData, TVariables>,
  variables: TVariables,
): Promise<TData> => {
  setResponseHeader('cache-control', 'private, no-store')
  const token = readToken(getRequest().headers.get('cookie'))
  const endpoint = process.env.GRAPHQL_ENDPOINT || LOCAL_PHOENIX_GRAPHQL_ENDPOINT
  const response = await fetch(endpoint, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      ...(token ? { cookie: `${GROUPHER_AUTH_TOKEN_COOKIE}=${token}` } : {}),
    },
    body: JSON.stringify({ query: print(query), variables }),
  })
  const responseText = await response.text()
  let payload: GraphQLResponse<TData>
  try {
    payload = JSON.parse(responseText) as GraphQLResponse<TData>
  } catch {
    throw new GraphQLRequestError(`GraphQL request failed with HTTP ${response.status}.`)
  }
  if (!response.ok || payload.errors?.length) {
    const error = payload.errors?.[0]
    const rawCode = error?.extensions?.reasonCode ?? error?.extensions?.code
    throw new GraphQLRequestError(
      error?.message || `GraphQL request failed with HTTP ${response.status}.`,
      typeof rawCode === 'string' ? rawCode : undefined,
    )
  }
  if (!payload.data) throw new GraphQLRequestError('GraphQL response did not include data.')
  return payload.data
}
import { LOCAL_PHOENIX_GRAPHQL_ENDPOINT } from '@groupher/contracts/endpoint'
