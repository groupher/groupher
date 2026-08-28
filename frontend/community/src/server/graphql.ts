import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { GROUPHER_AUTH_TOKEN_COOKIE } from '@groupher/contracts/auth'
import { getRequest, setResponseHeader } from '@tanstack/react-start/server'
import { print, type DocumentNode } from 'graphql'

export type TGraphQLResponse<TData> = {
  data?: TData
  errors?: Array<{ extensions?: { code?: unknown }; message?: string }>
}

export class GraphQLRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: NonNullable<TGraphQLResponse<unknown>['errors']> = [],
  ) {
    super(message)
    this.name = 'GraphQLRequestError'
  }
}

/** Reads the Groupher auth token from the active TanStack server request. */
export const getAuthToken = (): string | null => {
  const cookieHeader = getRequest().headers.get('cookie')
  if (!cookieHeader) return null
  for (const cookie of cookieHeader.split(';')) {
    const [name, ...value] = cookie.trim().split('=')
    if (name === GROUPHER_AUTH_TOKEN_COOKIE) return value.join('=')
  }
  return null
}

/** Prevents session-scoped loader responses from entering shared caches. */
export const setPrivateCacheHeader = (): void => {
  setResponseHeader('cache-control', 'private, no-store')
}

/** Executes a bounded server-side GraphQL request for Community loaders. */
export async function fetchGraphQL<TData>(
  query: string | DocumentNode | TypedDocumentNode<TData, Record<string, unknown>>,
  variables: Record<string, unknown>,
  token: string | null = null,
  options: { allowErrorCodes?: readonly number[] } = {},
): Promise<TGraphQLResponse<TData>> {
  const response = await fetch(process.env.GRAPHQL_ENDPOINT || 'http://127.0.0.1:4001/graphiql', {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { cookie: `${GROUPHER_AUTH_TOKEN_COOKIE}=${token}` } : {}),
    },
    body: JSON.stringify({ query: typeof query === 'string' ? query : print(query), variables }),
  })
  let payload: TGraphQLResponse<TData>
  try {
    payload = (await response.json()) as TGraphQLResponse<TData>
  } catch {
    throw new GraphQLRequestError(
      `GraphQL endpoint returned invalid JSON (${response.status})`,
      response.status,
    )
  }

  if (!response.ok) {
    throw new GraphQLRequestError(
      payload.errors?.[0]?.message || `GraphQL endpoint returned HTTP ${response.status}`,
      response.status,
      payload.errors || [],
    )
  }

  if (payload.errors?.length) {
    const allowedCodes = new Set(options.allowErrorCodes || [])
    const hasOnlyAllowedErrors =
      allowedCodes.size > 0 &&
      payload.errors.every(({ extensions }) => allowedCodes.has(Number(extensions?.code)))
    if (hasOnlyAllowedErrors) return payload

    throw new GraphQLRequestError(
      payload.errors.map((error) => error.message || 'GraphQL request failed').join('; '),
      response.status,
      payload.errors,
    )
  }

  if (payload.data === undefined) {
    throw new GraphQLRequestError('GraphQL response did not include data', response.status)
  }

  return payload
}
