import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LANDING_SITE = process.env.LANDING_SITE || 'https://landing.groupher.com'
const MAIN_SITE = process.env.MAIN_SITE || 'https://main.groupher.com'

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isLandingRequest =
    request.nextUrl.pathname === '/' || request.nextUrl.pathname.startsWith('/landing/_next/static')

  if (isLandingRequest) {
    return NextResponse.rewrite(new URL(pathname, LANDING_SITE))
  }

  return NextResponse.rewrite(new URL(pathname, MAIN_SITE))
}

export const config = {
  matcher: '/:path*',
}
