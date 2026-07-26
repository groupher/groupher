import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { includes } from 'ramda'

import { GROUPHER_AUTH_TOKEN_COOKIE } from '~/constant/auth-contract'

import {
  getDashboardUrl,
  isAuthRoute,
  isDashboardRoute,
  isDashboardStaticRoute,
  isGraphqlRoute,
  isLandingHost,
  isLandingStaticRoute,
  isMainHost,
  SITE,
  STATIC_PATHS,
} from './utils'

// chore: trigger
export default function proxy(request: NextRequest) {
  const url = request.nextUrl
  const { pathname, search } = url
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost || url.host

  const fullPath = pathname + search

  if (isAuthRoute(pathname)) {
    return NextResponse.rewrite(new URL(fullPath, SITE.AUTH))
  }

  if (isGraphqlRoute(pathname)) {
    const requestHeaders = new Headers(request.headers)
    const authToken = request.cookies.get(GROUPHER_AUTH_TOKEN_COOKIE)?.value

    requestHeaders.delete('authorization')
    requestHeaders.delete('cookie')
    if (authToken) {
      requestHeaders.set('cookie', `${GROUPHER_AUTH_TOKEN_COOKIE}=${encodeURIComponent(authToken)}`)
    }

    return NextResponse.rewrite(new URL(`/graphiql${search}`, SITE.API), {
      request: { headers: requestHeaders },
    })
  }

  if (isMainHost(host)) {
    return NextResponse.rewrite(new URL(fullPath, SITE.MAIN))
  }

  if (isLandingHost(host)) {
    return NextResponse.rewrite(new URL(fullPath, SITE.LANDING))
  }

  if (isDashboardRoute(pathname, host)) {
    const dashboardUrl = getDashboardUrl(pathname, host, search)
    return NextResponse.rewrite(dashboardUrl)
  }

  if (isDashboardStaticRoute(pathname)) {
    return NextResponse.rewrite(new URL(fullPath, SITE.DASHBOARD))
  }

  if (includes(pathname, STATIC_PATHS) || isLandingStaticRoute(pathname)) {
    return NextResponse.rewrite(new URL(fullPath, SITE.LANDING))
  }

  return NextResponse.rewrite(new URL(fullPath, SITE.MAIN))
}

export const config = {
  matcher: '/:path*',
}
