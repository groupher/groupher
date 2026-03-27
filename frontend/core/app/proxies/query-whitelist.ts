import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { SEARCH_PARAM } from '~/constant/url'

// 白名单参数数组
const ALLOWED_PARAMS = [
  'theme',
  'mode',
  'tag',
  'page',
  'cat',
  'state',
  'order',
  SEARCH_PARAM.COMMUNITY,
]

export function queryWhitelistProxy(req: NextRequest) {
  const url = new URL(req.url)
  let hasNotAllowedParams = false

  // 检查URL中的查询参数是否都在白名单中
  for (const key of url.searchParams.keys()) {
    if (!ALLOWED_PARAMS.includes(key)) {
      hasNotAllowedParams = true
    }
  }

  // 如果发现不在白名单中的查询参数，重设URL查询参数，只包括白名单内的
  if (hasNotAllowedParams) {
    const searchParams = new URLSearchParams()

    for (const param in ALLOWED_PARAMS) {
      const value = url.searchParams.get(ALLOWED_PARAMS[param])
      if (value !== null) {
        searchParams.set(ALLOWED_PARAMS[param], value)
      }
    }

    // 重构URL的查询部分
    const newUrl = `${url.origin + url.pathname}?${searchParams.toString()}`

    return NextResponse.rewrite(newUrl)
  }

  // 如果所有查询参数都在白名单内或者没有查询参数，保持原样
  return NextResponse.next()
}
