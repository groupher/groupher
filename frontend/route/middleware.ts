import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { includes, startsWith } from 'ramda'

const LANDING_SITE = process.env.LANDING_SITE || 'https://landing.groupher.com'
const MAIN_SITE = process.env.MAIN_SITE || 'https://main.groupher.com'
const STATIC_PATHS = ['/', '/pricing', '/book-demo']

const getNextStaticSign = (url) => {
  const subdomain = new URL(url).hostname.split('.')[0]

  return `/${subdomain}/_next/static`
}

const LANDING_STATIC_SIGN = getNextStaticSign(LANDING_SITE)

/**
 * @description
 * Check if the page is a static page from groupher landing.
 * @param {NextRequest} request - The request object.
 * @returns {boolean} - If the page is a static page from groupher landing.
 */
const checkStaticPage = (pathname: string): boolean => {
  return includes(pathname, STATIC_PATHS) || startsWith(LANDING_STATIC_SIGN, pathname)
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isStaticPage = checkStaticPage(pathname)

  if (isStaticPage) {
    return NextResponse.rewrite(new URL(pathname, LANDING_SITE))
  }

  return NextResponse.rewrite(new URL(pathname, MAIN_SITE))
}

export const config = {
  matcher: '/:path*',
}
