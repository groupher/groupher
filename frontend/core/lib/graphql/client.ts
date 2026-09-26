import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import {
  AUTH_ERROR,
  GROUPHER_AUTH_CSRF_HEADER,
  GROUPHER_AUTH_CSRF_VALUE,
  GROUPHER_AUTH_SIGNED_IN_COOKIE,
} from '@groupher/contracts/auth'
import { API_ROUTE } from '@groupher/route-contract'
import { print, type DocumentNode } from 'graphql'

import { invalidateAuthState, resolveAuthFailure, withAuthRetry } from '~/auth'

const ACCOUNT_LOGIN_ERROR_CODE = 4301

type TGraphQLError = {
  message?: unknown
  extensions?: Record<string, unknown>
}

const COMMAND_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  '4530': 'This operation changed elsewhere. Refresh and try again.',
  '4531': 'This operation is still being processed. Please try again shortly.',
  '4532': 'This operation is missing its command key. Please submit it again.',
}

type TGraphQLPayload<TResult> = {
  data?: TResult
  errors?: unknown
}

const formatGraphQLErrorMessage = (message: unknown): string => {
  if (typeof message === 'string') return message
  if (Array.isArray(message)) {
    return message
      .map((item) => {
        if (!item || typeof item !== 'object') return String(item)
        const entry = item as { key?: unknown; message?: unknown }
        const detail =
          typeof entry.message === 'string' ? entry.message : String(entry.message ?? '')
        return entry.key ? `${String(entry.key)}: ${detail}` : detail
      })
      .filter(Boolean)
      .join('\n')
  }
  if (message && typeof message === 'object') return JSON.stringify(message)
  return message == null ? '' : String(message)
}

const commandErrorMessage = (extensions?: Record<string, unknown>): string | undefined => {
  const code = extensions?.reasonCode ?? extensions?.code
  if (typeof code !== 'string' && typeof code !== 'number') return undefined
  return COMMAND_ERROR_MESSAGES[String(code)]
}

const formatRequestErrorMessage = (error: TGraphQLError): string =>
  commandErrorMessage(error.extensions) || formatGraphQLErrorMessage(error.message)

const graphQLErrors = (payload: unknown): TGraphQLError[] => {
  if (!payload || typeof payload !== 'object') return []
  const errors = (payload as TGraphQLPayload<unknown>).errors
  if (!Array.isArray(errors)) return []

  return errors
    .filter((error): error is Record<string, unknown> =>
      Boolean(error && typeof error === 'object'),
    )
    .map((error) => {
      const extensions =
        error.extensions && typeof error.extensions === 'object'
          ? (error.extensions as Record<string, unknown>)
          : undefined
      return { extensions, message: error.message }
    })
}

export class GraphQLRequestError extends Error {
  readonly errors: TGraphQLError[]
  readonly response: Response

  constructor(response: Response, errors: TGraphQLError[]) {
    super(
      errors.map(formatRequestErrorMessage).filter(Boolean).join('\n') || 'GraphQL request failed.',
    )
    this.name = 'GraphQLRequestError'
    this.errors = errors
    this.response = response
  }
}

export class GraphQLResponseError extends Error {
  readonly cause?: unknown
  readonly payload?: unknown
  readonly response: Response

  constructor(
    message: string,
    response: Response,
    options: { cause?: unknown; payload?: unknown } = {},
  ) {
    super(message)
    this.name = 'GraphQLResponseError'
    this.response = response
    this.cause = options.cause
    this.payload = options.payload
  }
}

const hasSignedInHint = (): boolean =>
  typeof document !== 'undefined' &&
  document.cookie.split(';').some((item) => item.trim() === `${GROUPHER_AUTH_SIGNED_IN_COOKIE}=1`)

const normalizeAuthCode = (code: unknown): string | undefined => {
  if (typeof code === 'string') return code
  if (code === ACCOUNT_LOGIN_ERROR_CODE && hasSignedInHint()) return AUTH_ERROR.TOKEN_MISSING
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
 */
export const GRAPHQL_FETCH_OPTIONS = (): RequestInit => ({
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    [GROUPHER_AUTH_CSRF_HEADER]: GROUPHER_AUTH_CSRF_VALUE,
  },
})

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
      return { code: AUTH_ERROR.TOKEN_MISSING, status: response.status }
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

export type TBrowserGraphQLRequestOptions = {
  fetcher?: typeof fetch
  signal?: AbortSignal
}

const browserGraphQLEndpoint = (): string =>
  typeof window === 'undefined'
    ? API_ROUTE.GRAPHQL
    : new URL(API_ROUTE.GRAPHQL, window.location.origin).toString()

/** Typed same-origin GraphQL transport shared by TanStack Query and mutations. */
export const browserGraphQLRequest = async <
  TResult,
  TVariables extends object = Record<string, unknown>,
>(
  document: string | DocumentNode | TypedDocumentNode<TResult, TVariables>,
  variables: TVariables = {} as TVariables,
  options: TBrowserGraphQLRequestOptions = {},
): Promise<TResult> => {
  const fetcher = createAuthFetch(options.fetcher || fetch)
  const fetchOptions = GRAPHQL_FETCH_OPTIONS()
  const response = await fetcher(browserGraphQLEndpoint(), {
    body: JSON.stringify({
      query: typeof document === 'string' ? document : print(document),
      variables,
    }),
    cache: 'no-store',
    credentials: fetchOptions.credentials,
    headers: fetchOptions.headers,
    method: 'POST',
    signal: options.signal,
  })

  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    if (!response.ok) throw new GraphQLRequestError(response, [])
    throw new GraphQLResponseError('GraphQL response returned invalid JSON.', response, {
      cause: error,
    })
  }

  const errors = graphQLErrors(payload)
  if (!response.ok || errors.length > 0) throw new GraphQLRequestError(response, errors)
  if (
    !payload ||
    typeof payload !== 'object' ||
    (payload as TGraphQLPayload<TResult>).data === undefined
  ) {
    throw new GraphQLResponseError('GraphQL response did not include data.', response, { payload })
  }

  return (payload as TGraphQLPayload<TResult>).data as TResult
}
