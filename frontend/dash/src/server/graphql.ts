import { serializeGraphQLError } from '@dash/utils/graphql-error'
import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import {
  GROUPHER_AUTH_SIGNED_IN_COOKIE,
  GROUPHER_AUTH_TOKEN_COOKIE,
} from '@groupher/contracts/auth'
import { getRequest, setResponseHeader } from '@tanstack/react-start/server'
import { print, type DocumentNode } from 'graphql'

export type TGraphQLResponse<TData> = {
  data?: TData
  errors?: Array<{ extensions?: { code?: unknown }; message?: string }>
}

export class GraphQLRequestError extends Error {
  readonly code?: string
  readonly status?: number

  constructor(message: string, options: { code?: string; status?: number } = {}) {
    super(message)
    this.name = 'GraphQLRequestError'
    this.code = options.code
    this.status = options.status
  }
}

/** Reads auth token through the bounded frontend shared interface. */
export const readAuthToken = (cookieHeader: string | null): string | null => {
  if (!cookieHeader) return null

  for (const cookie of cookieHeader.split(';')) {
    const [name, ...value] = cookie.trim().split('=')
    if (name === GROUPHER_AUTH_TOKEN_COOKIE) return value.join('=')
  }

  return null
}

/** Returns auth token for the frontend shared workflow. */
export const getAuthToken = (): string | null => readAuthToken(getRequest().headers.get('cookie'))

/** Returns whether the active request carries the non-sensitive login hint. */
export const hasSignedInHint = (cookieHeader = getRequest().headers.get('cookie')): boolean => {
  return Boolean(
    cookieHeader?.split(';').some((item) => item.trim() === `${GROUPHER_AUTH_SIGNED_IN_COOKIE}=1`),
  )
}

// Dashboard HTML and loader data are scoped to the current session.
/** Runs the set private cache header operation at the frontend shared boundary. */
export const setPrivateCacheHeader = (): void => {
  setResponseHeader('cache-control', 'private, no-store')
}

export function fetchGraphQL<TResult, TVariables extends Record<string, unknown>>(
  query: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables,
  token: string | null,
): Promise<TGraphQLResponse<TResult>>
export function fetchGraphQL<TData>(
  query: string | DocumentNode,
  variables: Record<string, unknown>,
  token: string | null,
): Promise<TGraphQLResponse<TData>>
/** Runs the fetch graph ql operation at the frontend shared boundary. */
export async function fetchGraphQL<TData>(
  query: string | DocumentNode,
  variables: Record<string, unknown>,
  token: string | null,
): Promise<TGraphQLResponse<TData>> {
  const endpoint = process.env.GRAPHQL_ENDPOINT || 'http://127.0.0.1:4001/graphiql'
  const response = await fetch(endpoint, {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { cookie: `${GROUPHER_AUTH_TOKEN_COOKIE}=${token}` } : {}),
    },
    body: JSON.stringify({ query: typeof query === 'string' ? query : print(query), variables }),
  })

  if (!response.ok) {
    throw new GraphQLRequestError(`GraphQL request failed with HTTP ${response.status}.`, {
      status: response.status,
    })
  }

  const payload = (await response.json()) as TGraphQLResponse<TData>
  if (payload.errors?.length) {
    const rawCode = payload.errors
      .map((error) => error.extensions?.code)
      .find((value) => value !== undefined)
    const code =
      typeof rawCode === 'string'
        ? rawCode
        : rawCode === 4301 && hasSignedInHint()
          ? 'TOKEN_MISSING'
          : undefined
    throw new GraphQLRequestError(
      serializeGraphQLError(
        payload.errors.map(({ message }) => message || 'GraphQL request failed.').join('; '),
        code,
      ),
      { code, status: response.status },
    )
  }

  return payload
}
