import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { ROUTE } from '~/const/route'

export function avoidScanMiddleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 检查pathname是否以.php或.php7结束
  if (pathname.endsWith('.php') || pathname.endsWith('.php7')) {
    // 重定向到/oops页面
    return NextResponse.redirect(new URL(ROUTE.OOPS, req.url))
  }

  // 如果路径不以.php或.php7结束，则继续处理后续中间件
  return NextResponse.next()
}
