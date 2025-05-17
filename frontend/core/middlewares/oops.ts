import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { ROUTE } from '~/const/route'

export function oopsMiddleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 若路径为 /404，则重定向到自定义404页面
  // just demo
  if (pathname === '/404') {
    // return NextResponse.rewrite(new URL(ROUTE.OOPS, req.url))
    return NextResponse.redirect(new URL(ROUTE.OOPS, req.url))
  }

  return NextResponse.next()
}
