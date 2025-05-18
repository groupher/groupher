import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import THEME from '~/const/theme'

const excludedPaths = /\.(js|png|jpg|jpeg|gif|svg|webp|ico)$/

export function themeMiddleware(request: NextRequest) {
  if (excludedPaths.test(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  const themeCookie = request.cookies.get('theme')

  if (themeCookie && themeCookie.value === THEME.DARK) {
    const url = request.nextUrl.clone()

    url.searchParams.set('theme', THEME.DARK)

    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}
