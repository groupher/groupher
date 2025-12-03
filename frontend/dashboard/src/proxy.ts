import type { NextRequest } from 'next/server'
import { avoidScanMiddleware } from '~/proxies/avoid-scan'
import { applyProxy } from '~/proxies/helper'
import { oopsMiddleware } from '~/proxies/oops'
// import { themeMiddleware } from './middlewares/theme'
import { queryWhitelistMiddleware } from '~/proxies/query-whitelist'
import { urlPeekMiddleware } from '~/proxies/url-peek'

export function proxy(request: NextRequest) {
  // proxy in this array will be applied in order
  const proxyFunctions = [
    avoidScanMiddleware,
    oopsMiddleware,
    queryWhitelistMiddleware,
    urlPeekMiddleware,
  ]

  return applyProxy(proxyFunctions, request)
}
