import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { startsWith } from 'ramda'

const LANDING_SITE = process.env.LANDING_SITE || 'https://landing.groupher.com'
const MAIN_SITE = process.env.MAIN_SITE || 'https://main.groupher.com'
const DASHBOARD_SITE = process.env.DASHBOARD_SITE || 'https://dashboard.groupher.com'

const DASHBOARD_DOMAIN = 'dashboard'

const getNextStaticSign = (url) => {
  const subdomain = new URL(url).hostname.split('.')[0]
  return `/${subdomain}/_next/static`
}

const LANDING_STATIC_SIGN = getNextStaticSign(LANDING_SITE)
const DASHBOARD_STATIC_SIGN = getNextStaticSign(DASHBOARD_SITE)

const isLandingStaticRoute = (pathname: string): boolean => {
  return startsWith(LANDING_STATIC_SIGN, pathname)
}

const isDashboardStaticRoute = (pathname: string): boolean => {
  return startsWith(DASHBOARD_STATIC_SIGN, pathname)
}

const isDashboardRoute = (pathname: string, host: string): boolean => {
  if (host.startsWith(`${DASHBOARD_DOMAIN}.`)) {
    return true
  }

  const pathParts = pathname.split('/').filter(Boolean)
  console.log('## pathParts: ', pathParts)

  if (pathParts.length >= 2 && pathParts[1] === 'dashboard') {
    return true
  }

  return false
}

export default function middleware(request: NextRequest) {
  const url = request.nextUrl
  const { pathname, host, search } = url

  console.log('## url: ', url)
  console.log('## isDashboardRoute: ', isDashboardRoute(pathname, host))

  // 检查是否是 dashboard 路由
  if (isDashboardRoute(pathname, host)) {
    const dashboardPath = pathname
      .split('/')
      .filter((part) => part !== 'dashboard')
      .join('/')
    return NextResponse.rewrite(new URL(dashboardPath + search, DASHBOARD_SITE))
  }

  // 检查是否是 dashboard 静态资源
  if (isDashboardStaticRoute(pathname)) {
    return NextResponse.rewrite(new URL(pathname + search, DASHBOARD_SITE))
  }

  // 检查是否是 landing 静态资源
  if (isLandingStaticRoute(pathname)) {
    return NextResponse.rewrite(new URL(pathname + search, LANDING_SITE))
  }

  // 所有其他情况重写到主站点
  return NextResponse.rewrite(new URL(pathname + search, MAIN_SITE))
}

export const config = {
  matcher: '/:path*',
}
