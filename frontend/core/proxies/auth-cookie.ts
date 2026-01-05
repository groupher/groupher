import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { AUTH_KEY } from '~/const/oauth'
import { setCookies } from '~/utils/localStorage'

const hasBackendAuthCookie = (req: Request) => {
  const cookie = req.headers.get('cookie')
  if (!cookie) return false

  return cookie.split(';').some((c) => c.trim().startsWith(`${AUTH_KEY.TOKEN}=`))
}

export async function authCookieProxy(req: Request) {
  const res = NextResponse.next()

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    raw: false,
  })

  // 1️⃣ NextAuth session not ready
  if (!token?.[AUTH_KEY.TOKEN] || !token?.[AUTH_KEY.USER]) {
    return res
  }

  // 2️⃣ Already synced backend cookie, skip
  if (hasBackendAuthCookie(req)) {
    return res
  }

  // 3️⃣ First time sync
  setCookies(res, {
    [AUTH_KEY.TOKEN]: String(token[AUTH_KEY.TOKEN]),
    [AUTH_KEY.USER]: JSON.stringify(token[AUTH_KEY.USER]),
  })

  return res
}
