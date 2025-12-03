import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { includes } from 'ramda'

import {
  getDashboardUrl,
  isDashboardRoute,
  isDashboardStaticRoute,
  isLandingStaticRoute,
  SITE,
  STATIC_PATHS,
} from './utils'

export default function proxy(request: NextRequest) {
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
