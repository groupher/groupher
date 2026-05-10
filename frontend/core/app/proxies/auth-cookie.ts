import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'

import { AUTH_KEY } from '~/const/oauth'

const setCookies = (
  res: NextResponse,
  cookies: Record<string, string>,
  options?: Partial<{
    path: string
    secure: boolean
    sameSite: 'lax' | 'strict' | 'none'
    maxAge: number
    httpOnly: boolean
  }>,
) => {
  const defaultOptions = {
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 14, // default 14 days
    httpOnly: true,
    ...options,
  }

  for (const [key, value] of Object.entries(cookies)) {
    res.cookies.set(key, value, defaultOptions)
  }
}

const getBackendAuthCookie = (req: Request): string | null => {
  const cookie = req.headers.get('cookie')
  if (!cookie) return null

  const authCookie = cookie.split(';').find((c) => c.trim().startsWith(`${AUTH_KEY.TOKEN}=`))
  if (!authCookie) return null

  return decodeURIComponent(authCookie.trim().slice(`${AUTH_KEY.TOKEN}=`.length))
}

export async function authCookieProxy(req: Request) {
  const res = NextResponse.next()

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    raw: false,
  })

  // 1️⃣ NextAuth session not ready
  if (!token?.[AUTH_KEY.TOKEN]) {
    return res
  }

  const backendToken = String(token[AUTH_KEY.TOKEN])

  // 2️⃣ Already synced backend cookie, skip
  if (getBackendAuthCookie(req) === backendToken) {
    return res
  }

  // 3️⃣ First time sync
  setCookies(res, {
    [AUTH_KEY.TOKEN]: backendToken,
  })

  return res
}
