import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { ROUTE } from '~/const/route'

export function avoidScanProxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 仅在开发模式下执行这个规避逻辑
  if (process.env.NODE_ENV === 'development') {
    // 检查 pathname 是否以 /.well-known 开头
    if (pathname.startsWith('/.well-known')) {
      // 可以在这里重定向到 OOPS 页面，或者直接返回 404
      console.log('## -----> DEV MODE: Redirecting .well-known request to OOPS page.')

      // 假设 ROUTE.OOPS 是 '/oops'
      // return NextResponse.redirect(new URL(ROUTE.OOPS, req.url));

      // 或者只是返回一个 404，防止进入动态路由
      // return new NextResponse(null, { status: 404 })
      return NextResponse.redirect(new URL(ROUTE.OOPS, req.url))
    }
  }

  // 检查pathname是否以.php或.php7结束
  if (pathname.endsWith('.php') || pathname.endsWith('.php7')) {
    // 重定向到/oops页面
    return NextResponse.redirect(new URL(ROUTE.OOPS, req.url))
  }

  // 如果路径不以.php或.php7结束，则继续处理后续中间件
  return NextResponse.next()
}
