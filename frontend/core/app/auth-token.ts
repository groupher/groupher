import { getToken } from 'next-auth/jwt'

import { getAuthSessionCookieName } from '~/constant/auth-contract'

const secureCookie =
  process.env.AUTH_URL?.startsWith('https://') ||
  process.env.AUTH_COOKIE_SECURE === 'true' ||
  process.env.NODE_ENV === 'production'

export const getAuthToken = (request: Request) =>
  getToken({
    req: request,
    cookieName: getAuthSessionCookieName(secureCookie),
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie,
    raw: false,
  })
