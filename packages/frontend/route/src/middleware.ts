import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()

  // 处理首页和 pricing 页面
  if (url.pathname === '/' || url.pathname === '/pricing') {
    return NextResponse.rewrite(new URL(`https://groupher-landing.vercel.app${url.pathname}`))
  }

  // 所有其他路径重定向到主应用
  return NextResponse.rewrite(new URL(`https://groupher-main.vercel.app${url.pathname}`))
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
