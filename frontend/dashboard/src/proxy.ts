import type { NextRequest } from 'next/server'
import { authCookieProxy } from '~/proxies/auth-cookie'
import { avoidScanProxy } from '~/proxies/avoid-scan'
import { applyProxy } from '~/proxies/helper'
import { oopsProxy } from '~/proxies/oops'
import { queryWhitelistProxy } from '~/proxies/query-whitelist'
import { urlPeekProxy } from '~/proxies/url-peek'

export async function proxy(request: NextRequest) {
  // proxy in this array will be applied in order
  const proxyFunctions = [
    avoidScanProxy,
    oopsProxy,
    queryWhitelistProxy,
    urlPeekProxy,
    authCookieProxy,
  ]
  return await applyProxy(proxyFunctions, request)
}
