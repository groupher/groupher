import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { includes } from 'ramda'

import {
  SITE,
  STATIC_PATHS,
  isLandingStaticRoute,
  isDashboardStaticRoute,
  isDashboardRoute,
  getDashboardUrl,
} from './utils'

export default function middleware(request: NextRequest) {
  const url = request.nextUrl
  const { pathname, host, search } = url

  const fullPath = pathname + search

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
