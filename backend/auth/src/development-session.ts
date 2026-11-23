/**
 * Cookie signing shared by isolated E2E and development Auth; absent from production builds.
 *
 * Business position:
 *   Admitted development or isolated E2E session -> Auth JWT + Phoenix HttpOnly cookies
 */
import { encode } from '@auth/core/jwt'
import { getAuthSessionCookieName } from '@groupher/contracts/auth'
import { serialize } from 'hono/utils/cookie'

import {
  appendPhoenixTokenCookie,
  BROWSER_SESSION_MAX_AGE,
  BROWSER_SESSION_USER_AGENT_MAX_LENGTH,
  signinOauth,
  type TBrowserSigninResult,
} from './auth'

/** Creates an isolated E2E provider session; never used by the development identity tool. */
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
  return createDevelopmentSessionResponse(browserSession, identity, nickname, secret)
}

/** Signs ordinary Auth and Phoenix cookies for an already admitted development session. */
export const createDevelopmentSessionResponse = async (
  browserSession: TBrowserSigninResult,
  identity: string,
  nickname: string,
  secret: string,
): Promise<Response> => {
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
