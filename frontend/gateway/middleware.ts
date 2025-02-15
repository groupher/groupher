import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { includes, startsWith } from 'ramda'

const LANDING_SITE = process.env.LANDING_SITE || 'https://landing.groupher.com'
const MAIN_SITE = process.env.MAIN_SITE || 'https://main.groupher.com'
const DASHBOARD_SITE = process.env.DASHBOARD_SITE || 'https://dashboard.groupher.com'
const STATIC_PATHS = ['/', '/pricing', '/book-demo']

const getNextStaticSign = (url) => {
  const subdomain = new URL(url).hostname.split('.')[0]

  return `/${subdomain}/_next/static`
}

const LANDING_STATIC_SIGN = getNextStaticSign(LANDING_SITE)

const isStaticRoute = (pathname: string): boolean => {
  return includes(pathname, STATIC_PATHS) || startsWith(LANDING_STATIC_SIGN, pathname)
}

const isDashboardRoute = (pathname: string, host: string): boolean => {
  if (host.startsWith('dashboard.')) {
    return true
  }

  const pathParts = pathname.split('/').filter(Boolean)
  if (pathParts.length >= 2 && pathParts[1] === 'dashboard') {
    return true
  }

  return false
}

export default function middleware(request: NextRequest) {
  const url = request.nextUrl
  const { pathname, host } = url

  // 检查是否为 dashboard 路由
  if (isDashboardRoute(pathname, host)) {
    // 如果是 dashboard 路由，重写到 dashboard 项目
    return NextResponse.rewrite(new URL(pathname, DASHBOARD_SITE))
  }

  const isStatic = isStaticRoute(pathname)

  if (isStatic) {
    return NextResponse.rewrite(new URL(pathname, LANDING_SITE))
  }

  return NextResponse.rewrite(new URL(pathname, MAIN_SITE))
}

export const config = {
  matcher: '/:path*',
}
