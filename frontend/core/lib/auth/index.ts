import {
  AUTH_ERROR,
  GROUPHER_AUTH_CSRF_HEADER,
  GROUPHER_AUTH_CSRF_VALUE,
} from '@groupher/contracts/auth'

import { AUTH_ENDPOINT } from '~/const/oauth'
import type { TOauthProvider } from '~/spec'

import { logout } from '../signal'
import { AUTH_CHANNEL, AUTH_EVENT, AUTH_RECOVERY } from './constant'
import type {
  TAuthEvent,
  TAuthFailure,
  TAuthRecovery,
  TBrowserSessionSummary,
  TLinkedOauthAccount,
} from './spec'

export { AUTH_CHANNEL, AUTH_DOM_EVENT, AUTH_EVENT } from './constant'
export { requestLogin } from './login-request'
export type {
  TAuthEvent,
  TAuthFailure,
  TAuthRecovery,
  TBrowserSessionSummary,
  TLinkedOauthAccount,
} from './spec'

type TCsrfResponse = {
  csrfToken?: unknown
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

const REFRESHABLE_CODES: ReadonlySet<string> = new Set([
  AUTH_ERROR.TOKEN_EXPIRED,
  AUTH_ERROR.TOKEN_MISSING,
])
const LOGIN_REQUIRED_CODES: ReadonlySet<string> = new Set([
  AUTH_ERROR.TOKEN_INVALID,
  AUTH_ERROR.TOKEN_REVOKED,
  AUTH_ERROR.SESSION_MISSING,
  AUTH_ERROR.SESSION_EXPIRED,
  AUTH_ERROR.SESSION_REVOKED,
  AUTH_ERROR.ACCOUNT_BLOCKED,
])
let refreshPromise: Promise<void> | null = null
let discardPromise: Promise<void> | null = null
let broadcastChannel: BroadcastChannel | null = null

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

const broadcast = (type: TAuthEvent) => {
  if (typeof window === 'undefined') return

  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel ??= new BroadcastChannel(AUTH_CHANNEL)
    broadcastChannel.postMessage({ type })
  }
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

/** Runs the auth failure from error operation at the frontend shared boundary. */
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

/** Runs the clear auth state operation at the frontend shared boundary. */
export const clearAuthState = (): void => {
  logout()
}

/** Runs the invalidate auth state operation at the frontend shared boundary. */
export const invalidateAuthState = (): void => {
  clearAuthState()
  broadcast(AUTH_EVENT.INVALID)
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
  broadcast(AUTH_EVENT.LOGOUT)
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
    broadcast(AUTH_EVENT.REFRESHED)
  })()

  try {
    await refreshPromise
  } finally {
    refreshPromise = null
  }
}

/** Lists sessions through the bounded frontend shared interface. */
export const listSessions = async (): Promise<TBrowserSessionSummary[]> => {
  const response = await fetch(`${AUTH_ENDPOINT}/sessions`, { credentials: 'include' })
  if (!response.ok) throw new Error(`Auth Session list failed with status ${response.status}.`)
  return (await response.json()) as TBrowserSessionSummary[]
}

/** Runs the revoke session operation at the frontend shared boundary. */
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

/** Runs the revoke other sessions operation at the frontend shared boundary. */
export const revokeOtherSessions = async (): Promise<void> => {
  const response = await fetch(`${AUTH_ENDPOINT}/sessions/revoke-others`, {
    credentials: 'include',
    headers: stateChangeHeaders(),
    method: 'POST',
  })
  if (!response.ok) throw new Error(`Auth Session revoke failed with status ${response.status}.`)
}

/** Lists linked oauth accounts through the bounded frontend shared interface. */
export const listLinkedOauthAccounts = async (): Promise<TLinkedOauthAccount[]> => {
  const response = await fetch(`${AUTH_ENDPOINT}/accounts`, { credentials: 'include' })
  if (!response.ok) throw await requestError(response, 'Auth account list')

  const payload = (await response.json()) as { accounts?: unknown }
  if (!Array.isArray(payload.accounts)) throw new Error('Auth returned invalid linked accounts.')
  return payload.accounts as TLinkedOauthAccount[]
}

/** Starts a provider-link flow through Auth and navigates to the provider. */
export const beginLinkedOauthAccount = async (
  provider: string,
  returnTo = typeof window !== 'undefined' ? window.location.href : '',
): Promise<void> => {
  const response = await fetch(`${AUTH_ENDPOINT}/accounts/${encodeURIComponent(provider)}/link`, {
    body: JSON.stringify({ returnTo }),
    credentials: 'include',
    headers: { ...stateChangeHeaders(), 'content-type': 'application/json' },
    method: 'POST',
  })
  if (!response.ok) throw await requestError(response, 'Auth account link')

  const payload = (await response.json()) as { authorizationUrl?: unknown }
  if (typeof payload.authorizationUrl !== 'string' || !payload.authorizationUrl) {
    throw new Error('Auth returned an invalid provider authorization URL.')
  }
  window.location.assign(payload.authorizationUrl)
}

/** Runs the unlink linked oauth account operation at the frontend shared boundary. */
export const unlinkLinkedOauthAccount = async (
  publicRef: string,
): Promise<TLinkedOauthAccount[]> => {
  const response = await fetch(
    `${AUTH_ENDPOINT}/accounts/${encodeURIComponent(publicRef)}/unlink`,
    {
      credentials: 'include',
      headers: stateChangeHeaders(),
      method: 'POST',
    },
  )
  if (!response.ok) throw await requestError(response, 'Auth account unlink')

  const payload = (await response.json()) as { accounts?: unknown }
  if (!Array.isArray(payload.accounts)) throw new Error('Auth returned invalid linked accounts.')
  return payload.accounts as TLinkedOauthAccount[]
}

/** Resolves auth failure without leaking frontend shared routing details to callers. */
export const resolveAuthFailure = (failure: TAuthFailure): TAuthRecovery => {
  if (failure.code && REFRESHABLE_CODES.has(failure.code)) return AUTH_RECOVERY.REFRESH
  if (failure.status === 401 || (failure.code && LOGIN_REQUIRED_CODES.has(failure.code))) {
    return AUTH_RECOVERY.LOGIN
  }
  if (failure.status === 403 || failure.code === AUTH_ERROR.PERMISSION_DENIED) {
    return AUTH_RECOVERY.PERMISSION
  }
  return AUTH_RECOVERY.NONE
}

const discardBrowserSession = async (): Promise<void> => {
  if (discardPromise) return discardPromise

  discardPromise = fetch(`${AUTH_ENDPOINT}/logout`, {
    credentials: 'include',
    headers: stateChangeHeaders(),
    method: 'POST',
  }).then(() => undefined)

  try {
    await discardPromise
  } finally {
    discardPromise = null
  }
}

const recoverTerminalFailure = async (error: unknown): Promise<boolean> => {
  if (resolveAuthFailure(authFailureFromError(error)) !== AUTH_RECOVERY.LOGIN) return false
  await discardBrowserSession()
  invalidateAuthState()
  return true
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
    if (action !== AUTH_RECOVERY.REFRESH) {
      if (action === AUTH_RECOVERY.LOGIN) {
        invalidateAuthState()
      }
      throw error
    }

    try {
      await refreshSession()
    } catch (refreshError) {
      // Public products are optional-auth. Once Auth has discarded a terminal
      // Session, replay as anonymous; protected UI owns the sign-in prompt.
      if (await recoverTerminalFailure(refreshError)) return operation()
      throw refreshError
    }
    return operation()
  }
}

/** Runs the session channel operation at the frontend shared boundary. */
export const sessionChannel = (): BroadcastChannel | null =>
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(AUTH_CHANNEL)
