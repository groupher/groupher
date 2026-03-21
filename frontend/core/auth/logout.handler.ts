import { NextResponse } from 'next/server'

import { AUTH_KEY } from '~/const/oauth'

const COOKIE_DOMAIN = process.env.NODE_ENV === 'production' ? '.groupher.com' : undefined

async function POST() {
  const res = NextResponse.json({ ok: true })

  res.cookies.set(AUTH_KEY.TOKEN, '', {
    path: '/',
    maxAge: 0,
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  })

  res.headers.set('Cache-Control', 'no-store')

  return res
}

export const handlers = { POST }
