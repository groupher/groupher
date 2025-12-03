import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// 允许的参数白名单
const ALLOWED_SEARCH_PARAMS = ['page', 'sort', 'filter', 'tab'] // 按需扩展

export function urlPeekProxy(request: NextRequest) {
  const url = request.nextUrl

  if (url.pathname.startsWith('/_next/') || url.pathname.includes('.')) {
    return NextResponse.next()
  }

  // 1. 过滤非法参数
  const safeParams = new URLSearchParams()
  for (const param of ALLOWED_SEARCH_PARAMS) {
    const value = url.searchParams.get(param)
    if (value !== null) {
      safeParams.set(param, value)
    }
  }

  const normalizedUrl = {
    pathname: url.pathname,
    search: safeParams.toString() ? `?${safeParams.toString()}` : '',
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-route', JSON.stringify(normalizedUrl))

  return NextResponse.next({ request: { headers: requestHeaders } })
}
