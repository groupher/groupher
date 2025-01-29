import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LANDING_URL = 'https://groupher-landing.vercel.app'
const MAIN_URL = 'https://groupher-main.vercel.app'

export default function middleware(request: NextRequest) {
  console.log('Middleware called for path:', request.nextUrl.pathname)

  const { pathname } = request.nextUrl

  const isLandingRequest = request.headers.get('x-groupher-part') === 'landing'

  if (isLandingRequest) {
    return NextResponse.rewrite(new URL(pathname, LANDING_URL))
  }

  return NextResponse.rewrite(new URL(pathname, MAIN_URL))
}

export const config = {
  matcher: '/:path*',
}
