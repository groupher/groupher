import { encode } from '@auth/core/jwt'
import { getAuthSessionCookieName } from '@groupher/contracts/auth'
import { serialize } from 'hono/utils/cookie'

import {
  appendPhoenixTokenCookie,
  BROWSER_SESSION_MAX_AGE,
  BROWSER_SESSION_USER_AGENT_MAX_LENGTH,
  signinOauth,
} from '../auth'

const sessionMaxAge = (expiresAt: string): number =>
  Math.max(
    1,
    Math.min(BROWSER_SESSION_MAX_AGE, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000)),
  )

export const testLogin = async (request: Request): Promise<Response> => {
  const secret = process.env.NEXTAUTH_SECRET?.trim()
  if (!secret) return Response.json({ code: 'TEST_AUTH_NOT_CONFIGURED' }, { status: 503 })

  const body = (await request.json().catch(() => ({}))) as { login?: unknown }
  const login = typeof body.login === 'string' && body.login.trim() ? body.login.trim() : 'e2e'
  const browserSession = await signinOauth(
    {
      provider: 'e2e',
      providerId: login,
      login,
      nickname: 'E2E User',
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
  const maxAge = sessionMaxAge(browserSession.sessionAbsoluteExpiresAt)
  const token = await encode({
    maxAge,
    salt: cookieName,
    secret,
    token: {
      browserSessionRef: browserSession.browserSessionRef,
      name: 'E2E User',
      sub: login,
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
