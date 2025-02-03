import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LANDING_SITE = process.env.LANDING_SITE || 'https://landing.groupher.com'
const MAIN_SITE = process.env.MAIN_SITE || 'https://main.groupher.com'

const getLandingStaticSign = (url) => {
  const subdomain = new URL(url).hostname.split('.')[0]

  return `/${subdomain}/_next/static`
}

const LANDING_STATIC_SIGN = getLandingStaticSign(LANDING_SITE)

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isLandingRequest =
    request.nextUrl.pathname === '/' || request.nextUrl.pathname.startsWith(LANDING_STATIC_SIGN)

  if (isLandingRequest) {
    return NextResponse.rewrite(new URL(pathname, LANDING_SITE))
  }

  return NextResponse.rewrite(new URL(pathname, MAIN_SITE))
}

export const config = {
  matcher: '/:path*',
}
