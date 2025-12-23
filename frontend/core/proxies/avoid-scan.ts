import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { ROUTE } from '~/const/route'

export function avoidScanProxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // if (process.env.NODE_ENV === 'development') {
  //   if (pathname.startsWith('/.well-known')) {
  //     console.log('## -----> DEV MODE: Redirecting .well-known request to OOPS page.')

  //     return NextResponse.redirect(new URL(ROUTE.OOPS, req.url))
  //   }
  // }

  // 检查pathname是否以.php或.php7结束
  if (pathname.endsWith('.php') || pathname.endsWith('.php7')) {
    // 重定向到/oops页面
    return NextResponse.redirect(new URL(ROUTE.OOPS, req.url))
  }

  // 如果路径不以.php或.php7结束，则继续处理后续中间件
  return NextResponse.next()
}
