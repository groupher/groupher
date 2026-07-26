import { GROUPHER_AUTH_TOKEN_COOKIE } from '@groupher/frontend-core/auth-contract'
import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  const domain =
    process.env.AUTH_COOKIE_DOMAIN?.trim() ||
    (process.env.NODE_ENV === 'production' ? '.groupher.com' : undefined)

  response.cookies.set(GROUPHER_AUTH_TOKEN_COOKIE, '', {
    path: '/',
    maxAge: 0,
    ...(domain ? { domain } : {}),
  })
  response.headers.set('Cache-Control', 'no-store')

  return response
}
