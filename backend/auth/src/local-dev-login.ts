/**
 * Local Auth login flags and request-boundary checks used only by the development login routes.
 *
 * ```text
 * Dev Hub local config -> ordinary/admin enable flags
 *                                  |
 * Auth local route -> non-production + loopback request -> local login allowed
 *                  -> missing flag / non-loopback request -> local login denied
 * ```
 */
/** Stable identity used by the ordinary, non-administrator local browser login. */
export const LOCAL_DEV_LOGIN_IDENTITY = 'local-debug'
/** Stable identity reserved for the separately gated local administrator login. */
export const LOCAL_DEV_ADMIN_LOGIN_IDENTITY = 'local-passport-admin'

const LOCAL_HOSTS = new Set(['auth.groupher.localhost', 'localhost', '127.0.0.1', '::1'])
type TLocalDevLoginHandler = (request: Request) => Promise<Response>
export type TLocalDevLoginHandlers = {
  testAdminLogin?: TLocalDevLoginHandler
  testLogin?: TLocalDevLoginHandler
}

/** Returns whether ordinary local login is enabled outside production. */
export const isLocalDevLoginEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.NODE_ENV?.trim().toLowerCase() !== 'production' && env.AUTH_LOCAL_LOGIN_ENABLED === 'true'

/** Returns whether the additional local administrator login is explicitly enabled. */
export const isLocalDevAdminLoginEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  isLocalDevLoginEnabled(env) && env.AUTH_LOCAL_ADMIN_LOGIN_ENABLED === 'true'

/** Restricts the local login route to HTTP(S) requests addressed to loopback hosts. */
export const isLocalDevLoginRequest = (request: Request): boolean => {
  try {
    const url = new URL(request.url)
    return ['http:', 'https:'].includes(url.protocol) && LOCAL_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}
import { encode } from '@auth/core/jwt'
import { AUTH_ERROR, getAuthSessionCookieName } from '@groupher/contracts/auth'
import { serialize } from 'hono/utils/cookie'

import {
  appendPhoenixTokenCookie,
  BROWSER_SESSION_MAX_AGE,
  BROWSER_SESSION_USER_AGENT_MAX_LENGTH,
  signinOauth,
} from './auth'

/** Creates the normal Phoenix browser session used by one fixed local debug identity. */
export const createDevelopmentLoginResponse = async (
  request: Request,
  identity: string,
  nickname: string,
  secret = process.env.NEXTAUTH_SECRET?.trim(),
): Promise<Response> => {
  if (!secret) return Response.json({ code: 'TEST_AUTH_NOT_CONFIGURED' }, { status: 503 })

  const browserSession = await signinOauth(
    {
      provider: 'e2e',
      providerId: identity,
      login: identity,
      nickname,
      avatar: 'https://static.groupher.com/icons/cmd/alien_user3.svg',
      bio: 'Auth V1 browser test account',
      country: '',
      city: '',
      company: '',
    },
    {
      userAgentSummary:
        request.headers.get('user-agent')?.slice(0, BROWSER_SESSION_USER_AGENT_MAX_LENGTH) ||
        undefined,
    },
  )
  const cookieName = getAuthSessionCookieName(true)
  const maxAge = Math.max(
    1,
    Math.min(
      BROWSER_SESSION_MAX_AGE,
      Math.floor((Date.parse(browserSession.sessionAbsoluteExpiresAt) - Date.now()) / 1000),
    ),
  )
  const token = await encode({
    maxAge,
    salt: cookieName,
    secret,
    token: {
      browserSessionRef: browserSession.browserSessionRef,
      name: nickname,
      sub: identity,
      sessionAbsoluteExpiresAt: browserSession.sessionAbsoluteExpiresAt,
    },
  })
  const headers = new Headers({ 'Cache-Control': 'no-store' })
  headers.append(
    'Set-Cookie',
    serialize(cookieName, token, {
      httpOnly: true,
      maxAge,
      path: '/',
      sameSite: 'lax',
      secure: true,
    }),
  )

  return appendPhoenixTokenCookie(new Response(null, { headers, status: 204 }), browserSession)
}

/** Registers local login handlers only when explicitly enabled outside production. */
export const createLocalDevLoginHandlers = (
  environment: NodeJS.ProcessEnv = process.env,
): TLocalDevLoginHandlers => {
  if (!isLocalDevLoginEnabled(environment)) return {}

  const forIdentity = (identity: string, nickname: string) => async (request: Request) => {
    if (!isLocalDevLoginRequest(request)) {
      return Response.json({ code: AUTH_ERROR.INVALID_ORIGIN }, { status: 400 })
    }
    return createDevelopmentLoginResponse(request, identity, nickname, environment.NEXTAUTH_SECRET)
  }

  return {
    testLogin: forIdentity(LOCAL_DEV_LOGIN_IDENTITY, 'Local Debug'),
    ...(isLocalDevAdminLoginEnabled(environment)
      ? { testAdminLogin: forIdentity(LOCAL_DEV_ADMIN_LOGIN_IDENTITY, 'Local Passport Admin') }
      : {}),
  }
}
