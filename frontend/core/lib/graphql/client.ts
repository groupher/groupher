import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import {
  GROUPHER_AUTH_CSRF_HEADER,
  GROUPHER_AUTH_CSRF_VALUE,
  GROUPHER_AUTH_SIGNED_IN_COOKIE,
} from '@groupher/contracts/auth'
import { print, type DocumentNode } from 'graphql'

import {
  AuthRequestError,
  invalidateAuthState,
  requestLogin,
  resolveAuthFailure,
  withAuthRetry,
} from '~/auth'

const ACCOUNT_LOGIN_ERROR_CODE = 4301

type TGraphQLError = {
  message?: string
  extensions?: { code?: unknown }
}

type TGraphQLCombinedError = {
  graphQLErrors: TGraphQLError[]
  networkError?: Error
  response?: Response
}

export class GraphQLRequestError extends Error {
  readonly errors: TGraphQLError[]
  readonly response: Response

  constructor(response: Response, errors: TGraphQLError[]) {
    super(
      errors
        .map((error) => error.message)
        .filter(Boolean)
        .join('\n') || 'GraphQL request failed.',
    )
    this.name = 'GraphQLRequestError'
    this.errors = errors
    this.response = response
  }
}

const hasSignedInHint = (): boolean =>
  typeof document !== 'undefined' &&
  document.cookie.split(';').some((item) => item.trim() === `${GROUPHER_AUTH_SIGNED_IN_COOKIE}=1`)

const normalizeAuthCode = (code: unknown): string | undefined => {
  if (typeof code === 'string') return code
  if (code === ACCOUNT_LOGIN_ERROR_CODE && hasSignedInHint()) return 'TOKEN_MISSING'
  return undefined
}

class GraphQLAuthResponseError extends Error {
  readonly failure: { code?: string; status?: number }
  readonly response: Response

  constructor(response: Response, failure: { code?: string; status?: number }) {
    super('GraphQL authentication requires refresh.')
    this.name = 'GraphQLAuthResponseError'
    this.failure = failure
    this.response = response
  }
}

/**
 * Browser-side fetch options shared by TanStack Query and imperative GraphQL
 * calls. Browser code always talks to the same-origin `/api/graphql` facade;
 * cookies are still included so the Next route handler can read the Groupher
 * auth token cookie and forward only that cookie to Phoenix.
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
    [GROUPHER_AUTH_CSRF_HEADER]: GROUPHER_AUTH_CSRF_VALUE,
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
  retryIf: (err: TGraphQLCombinedError | undefined) =>
    !!err?.networkError && !(err.networkError instanceof AuthRequestError),
}

/** Resolves graph qlfailure without leaking frontend shared routing details to callers. */
export const resolveGraphQLFailure = (
  error: TGraphQLCombinedError,
): { code?: string; status?: number } => {
  const code = error.graphQLErrors
    .map((item) => item.extensions?.code)
    .map(normalizeAuthCode)
    .find((item): item is string => typeof item === 'string')

  return { code, status: error.response?.status }
}

const responseAuthFailure = async (
  response: Response,
): Promise<{ code?: string; status?: number }> => {
  try {
    const payload = (await response.clone().json()) as {
      data?: { sessionState?: { isValid?: unknown } }
      errors?: Array<{ extensions?: { code?: unknown } }>
    }
    const rawCode = payload.errors
      ?.map((error) => error.extensions?.code)
      .find((value) => value !== undefined)
    const code = normalizeAuthCode(rawCode)
    // `sessionState` is the explicit authenticated probe. The public nullable
    // `me` field must never be used as a refresh signal.
    if (!code && payload.data?.sessionState?.isValid === false && hasSignedInHint()) {
      return { code: 'TOKEN_MISSING', status: response.status }
    }
    return { code, status: response.status }
  } catch {
    return { status: response.status }
  }
}

/** Browser GraphQL transport with one demand-driven refresh and one replay. */
export const createAuthFetch =
  (fetcher: typeof fetch = fetch): typeof fetch =>
  async (input, init) => {
    const replayInput = input instanceof Request ? input.clone() : input
    let attempt = 0

    try {
      return await withAuthRetry(
        async () => {
          const response = await fetcher(attempt++ === 0 ? input : replayInput, init)
          const failure = await responseAuthFailure(response)
          const action = resolveAuthFailure(failure)
          if (action === 'refresh') {
            throw new GraphQLAuthResponseError(response, failure)
          }
          if (action === 'login') {
            invalidateAuthState()
            requestLogin()
          }
          return response
        },
        (error) => (error instanceof GraphQLAuthResponseError ? error.failure : {}),
      )
    } catch (error) {
      if (error instanceof GraphQLAuthResponseError) return error.response
      throw error
    }
  }

/** Typed same-origin browser transport shared by TanStack Query and mutations. */
export const browserQuery = async <TResult, TVariables = Record<string, unknown>>(
  document: string | DocumentNode | TypedDocumentNode<TResult, TVariables>,
  variables: TVariables = {} as TVariables,
  fetcher: typeof fetch = fetch,
): Promise<TResult> => {
  const response = await createAuthFetch(fetcher)('/api/graphql', {
    ...GRAPHQL_FETCH_OPTIONS(),
    method: 'POST',
    cache: 'no-store',
    body: JSON.stringify({
      query: typeof document === 'string' ? document : print(document),
      variables,
    }),
  })
  const payload = (await response.json()) as { data?: TResult; errors?: TGraphQLError[] }

  if (!response.ok || payload.errors?.length || !payload.data) {
    throw new GraphQLRequestError(response, payload.errors || [])
  }

  return payload.data
}
