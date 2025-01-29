import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LANDING_URL = 'https://groupher-landing.vercel.app'
const MAIN_URL = 'https://groupher-main.vercel.app'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 检查请求头中是否包含 x-groupher-part: landing
  const isLandingRequest = request.headers.get('x-groupher-part') === 'landing'

  // 如果是 landing 请求，重定向到 landing 项目
  if (isLandingRequest) {
    return NextResponse.rewrite(new URL(pathname, LANDING_URL))
  }

  // 所有其他请求（包括静态资源）都重定向到 main 项目
  return NextResponse.rewrite(new URL(pathname, MAIN_URL))
}

// 配置 middleware 应该运行的路径
export const config = {
  matcher: ['/((?!api|_next/static|favicon.ico).*)', '/'],
}
