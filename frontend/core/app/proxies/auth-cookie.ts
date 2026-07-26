import { NextResponse } from 'next/server'

import { getAuthToken } from '~/app/auth-token'
import { AUTH_KEY } from '~/const/oauth'
import { GROUPHER_AUTH_TOKEN_COOKIE } from '~/constant/auth-contract'

const cookieDomain =
  process.env.AUTH_COOKIE_DOMAIN?.trim() ||
  (process.env.NODE_ENV === 'production' ? '.groupher.com' : undefined)

const setCookies = (
  res: NextResponse,
  cookies: Record<string, string>,
  options?: Partial<{
    path: string
    secure: boolean
    sameSite: 'lax' | 'strict' | 'none'
    maxAge: number
    httpOnly: boolean
    domain: string
  }>,
) => {
  const defaultOptions = {
    path: '/',
    secure:
      process.env.AUTH_COOKIE_SECURE === 'true' ||
      (process.env.AUTH_COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production'),
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 14, // default 14 days
    httpOnly: true,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
    ...options,
  }

  for (const [key, value] of Object.entries(cookies)) {
    res.cookies.set(key, value, defaultOptions)
  }
}

const getCookie = (req: Request, name: string): string | null => {
  const cookie = req.headers.get('cookie')
  if (!cookie) return null

  const matchedCookie = cookie.split(';').find((item) => item.trim().startsWith(`${name}=`))
  if (!matchedCookie) return null

  const rawValue = matchedCookie.trim().slice(`${name}=`.length)

  try {
    return decodeURIComponent(rawValue)
  } catch {
    return rawValue
  }
}

export const shouldSyncAuthTokenCookie = ({
  currentToken,
  nextToken,
}: {
  currentToken: string | null
  nextToken: string
}): boolean => currentToken !== nextToken

export async function authCookieProxy(req: Request) {
  const res = NextResponse.next()

  const token = await getAuthToken(req)

  // 1️⃣ NextAuth session not ready
  if (!token?.[AUTH_KEY.TOKEN]) {
    return res
  }

  const phoenixToken = String(token[AUTH_KEY.TOKEN])

  // 2️⃣ Already synced the canonical Groupher token cookie, skip
  const shouldSync = shouldSyncAuthTokenCookie({
    currentToken: getCookie(req, GROUPHER_AUTH_TOKEN_COOKIE),
    nextToken: phoenixToken,
  })

  if (!shouldSync) {
    return res
  }

  // 3️⃣ First sync or token refresh.
  setCookies(res, {
    [GROUPHER_AUTH_TOKEN_COOKIE]: phoenixToken,
  })

  return res
}
