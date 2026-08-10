import { GROUPHER_AUTH_CSRF_HEADER, GROUPHER_AUTH_CSRF_VALUE } from '@groupher/contracts/auth'

import { AUTH_ENDPOINT } from '~/const/oauth'
import type { TOauthProvider } from '~/spec'

import { logout } from '../signal'
import { requestLogin } from './login-request'

export { requestLogin } from './login-request'

type TCsrfResponse = {
  csrfToken?: unknown
}

export type TAuthFailure = {
  code?: string
  status?: number
}

export class AuthRequestError extends Error {
  readonly code?: string
  readonly status: number

  constructor(message: string, failure: TAuthFailure & { status: number }) {
    super(message)
    this.name = 'AuthRequestError'
    this.code = failure.code
    this.status = failure.status
  }
}

export type TBrowserSessionSummary = {
  browserFamily?: string | null
  createdCity?: string | null
  createdCountry?: string | null
  createdRegion?: string | null
  deviceFamily?: string | null
  insertedAt?: string | null
  isCurrent: boolean
  lastSeenCity?: string | null
  lastSeenCountry?: string | null
  lastSeenAt?: string | null
  lastSeenRegion?: string | null
  osFamily?: string | null
  publicRef: string
  status?: string | null
  userAgentSummary?: string | null
}

const REFRESHABLE_CODES = new Set(['TOKEN_EXPIRED', 'TOKEN_MISSING'])
let refreshPromise: Promise<void> | null = null

const appendHiddenField = (form: HTMLFormElement, name: string, value: string) => {
  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = name
  input.value = value
  form.append(input)
}

const stateChangeHeaders = (): HeadersInit => ({
  [GROUPHER_AUTH_CSRF_HEADER]: GROUPHER_AUTH_CSRF_VALUE,
})

const broadcast = (type: 'auth:refreshed' | 'auth:logout' | 'auth:invalid') => {
  if (typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel('groupher-auth')
  channel.postMessage({ type })
  channel.close()
}

const responseFailure = async (response: Response): Promise<TAuthFailure> => {
  try {
    const payload = (await response.clone().json()) as { code?: unknown }
    return {
      code: typeof payload.code === 'string' ? payload.code : undefined,
      status: response.status,
    }
  } catch {
    return { status: response.status }
  }
}

export const authFailureFromError = (error: unknown): TAuthFailure =>
  error instanceof AuthRequestError ? { code: error.code, status: error.status } : {}

const requestError = async (response: Response, operation: string): Promise<AuthRequestError> => {
  const failure = await responseFailure(response)
  return new AuthRequestError(`${operation} failed with status ${response.status}.`, {
    ...failure,
    status: response.status,
  })
}

/** Starts the canonical Auth OAuth flow without exposing browser credentials. */
export const signIn = async (
  provider: TOauthProvider,
  options?: { callbackUrl?: string },
): Promise<void> => {
  const callbackUrl = options?.callbackUrl ?? window.location.href
  const response = await fetch(`${AUTH_ENDPOINT}/csrf`, { credentials: 'include' })
  if (!response.ok) throw new Error(`Auth CSRF request failed with status ${response.status}.`)

  const payload = (await response.json()) as TCsrfResponse
  if (typeof payload.csrfToken !== 'string' || payload.csrfToken.length === 0) {
    throw new Error('Auth CSRF request returned an invalid token.')
  }

  const form = document.createElement('form')
  form.action = `${AUTH_ENDPOINT}/signin/${provider}`
  form.method = 'POST'
  form.style.display = 'none'
  appendHiddenField(form, 'csrfToken', payload.csrfToken)
  appendHiddenField(form, 'callbackUrl', callbackUrl)
  document.body.append(form)
  form.submit()
}

export const clearAuthState = (): void => {
  logout()
}

export const invalidateAuthState = (): void => {
  clearAuthState()
  broadcast('auth:invalid')
}

/** Revokes the current server-side Browser Session before clearing local UI state. */
export const signOut = async (onComplete?: () => void): Promise<void> => {
  const response = await fetch(`${AUTH_ENDPOINT}/logout`, {
    credentials: 'include',
    headers: stateChangeHeaders(),
    method: 'POST',
  })
  if (!response.ok) throw new Error(`Auth logout failed with status ${response.status}.`)

  clearAuthState()
  broadcast('auth:logout')
  onComplete?.()
}

/** Coalesces concurrent expired-token recovery in one product runtime. */
export const refreshSession = async (): Promise<void> => {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const response = await fetch(`${AUTH_ENDPOINT}/token/refresh`, {
      credentials: 'include',
      headers: stateChangeHeaders(),
      method: 'POST',
    })
    if (!response.ok) throw await requestError(response, 'Auth refresh')
    broadcast('auth:refreshed')
  })()

  try {
    await refreshPromise
  } finally {
    refreshPromise = null
  }
}

export const listSessions = async (): Promise<TBrowserSessionSummary[]> => {
  const response = await fetch(`${AUTH_ENDPOINT}/sessions`, { credentials: 'include' })
  if (!response.ok) throw new Error(`Auth Session list failed with status ${response.status}.`)
  return (await response.json()) as TBrowserSessionSummary[]
}

export const revokeSession = async (publicRef: string): Promise<void> => {
  const response = await fetch(
    `${AUTH_ENDPOINT}/sessions/${encodeURIComponent(publicRef)}/revoke`,
    {
      credentials: 'include',
      headers: stateChangeHeaders(),
      method: 'POST',
    },
  )
  if (!response.ok) throw new Error(`Auth Session revoke failed with status ${response.status}.`)
}

export const revokeOtherSessions = async (): Promise<void> => {
  const response = await fetch(`${AUTH_ENDPOINT}/sessions/revoke-others`, {
    credentials: 'include',
    headers: stateChangeHeaders(),
    method: 'POST',
  })
  if (!response.ok) throw new Error(`Auth Session revoke failed with status ${response.status}.`)
}

export const resolveAuthFailure = (
  failure: TAuthFailure,
): 'refresh' | 'login' | 'permission' | 'none' => {
  if (failure.code && REFRESHABLE_CODES.has(failure.code)) return 'refresh'
  if (
    failure.status === 401 ||
    (failure.code &&
      /TOKEN_(INVALID|REVOKED)|SESSION_(MISSING|EXPIRED|REVOKED)|ACCOUNT_BLOCKED/.test(
        failure.code,
      ))
  ) {
    return 'login'
  }
  if (failure.status === 403 || failure.code === 'PERMISSION_DENIED') return 'permission'
  return 'none'
}

const recoverTerminalFailure = async (error: unknown): Promise<void> => {
  if (resolveAuthFailure(authFailureFromError(error)) !== 'login') return
  invalidateAuthState()
  requestLogin()
}

/** Retries the original authenticated operation once after a successful refresh. */
export const withAuthRetry = async <T>(
  operation: () => Promise<T>,
  resolveFailure: (error: unknown) => TAuthFailure,
): Promise<T> => {
  try {
    return await operation()
  } catch (error) {
    const action = resolveAuthFailure(resolveFailure(error))
    if (action !== 'refresh') {
      if (action === 'login') {
        invalidateAuthState()
        requestLogin()
      }
      throw error
    }

    try {
      await refreshSession()
    } catch (refreshError) {
      await recoverTerminalFailure(refreshError)
      throw refreshError
    }
    return operation()
  }
}

export const sessionChannel = (): BroadcastChannel | null =>
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('groupher-auth')
