import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import THEME from '~/const/theme'

// 使用正则表达式来匹配需要排除的路径
// 使用正则表达式来匹配需要排除的路径，包括所有.js文件和图片文件类型
const excludedPaths = /\.(js|png|jpg|jpeg|gif|svg|webp|ico)$/

export function themeMiddleware(request: NextRequest) {
  // 如果请求的路径匹配排除路径，则直接放行

  if (excludedPaths.test(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  // 读取cookie中的theme值
  const themeCookie = request.cookies.get('theme')

  // 如果theme值为'night'，则重写URL
  if (themeCookie && themeCookie.value === THEME.DARK) {
    // 获取请求的URL
    const url = request.nextUrl.clone()

    // 为URL添加查询参数?theme=night
    url.searchParams.set('theme', THEME.DARK)

    // 重写请求的URL
    return NextResponse.rewrite(url)
  }

  // 如果theme不是'night'或路径被排除，中间件不做任何操作
  return NextResponse.next()
}
