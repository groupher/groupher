import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { ROUTE } from '~/const/route'

/** Runs the oops proxy operation at the frontend shared boundary. */
export function oopsProxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 若路径为 /404，则重定向到自定义404页面
  // just demo
  if (pathname === '/404') {
    return NextResponse.redirect(new URL(ROUTE.OOPS, req.url))
  }

  return NextResponse.next()
}
