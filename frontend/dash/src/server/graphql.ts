import { GROUPHER_AUTH_TOKEN_COOKIE } from '@groupher/contracts/auth'
import { getRequest, setResponseHeader } from '@tanstack/react-start/server'

export type TGraphQLResponse<TData> = {
  data?: TData
  errors?: Array<{ message?: string }>
}

export class GraphQLRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GraphQLRequestError'
  }
}

export const readAuthToken = (cookieHeader: string | null): string | null => {
  if (!cookieHeader) return null

  for (const cookie of cookieHeader.split(';')) {
    const [name, ...value] = cookie.trim().split('=')
    if (name === GROUPHER_AUTH_TOKEN_COOKIE) return value.join('=')
  }

  return null
}

export const getAuthToken = (): string | null => readAuthToken(getRequest().headers.get('cookie'))

// Dashboard HTML and loader data are scoped to the current session.
export const setPrivateCacheHeader = (): void => {
  setResponseHeader('cache-control', 'private, no-store')
}

export const fetchGraphQL = async <TData>(
  query: string,
  variables: Record<string, unknown>,
  token: string | null,
): Promise<TGraphQLResponse<TData>> => {
  const endpoint = process.env.GRAPHQL_ENDPOINT || 'http://127.0.0.1:4001/graphiql'
  const response = await fetch(endpoint, {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { cookie: `${GROUPHER_AUTH_TOKEN_COOKIE}=${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new GraphQLRequestError(`GraphQL request failed with HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as TGraphQLResponse<TData>
  if (payload.errors?.length) {
    throw new GraphQLRequestError(
      payload.errors.map(({ message }) => message || 'GraphQL request failed.').join('; '),
    )
  }

  return payload
}
