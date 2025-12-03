import type { NextRequest } from 'next/server'
import { avoidScanProxy } from '~/proxies/avoid-scan'
import { applyProxy } from '~/proxies/helper'
import { oopsProxy } from '~/proxies/oops'
import { queryWhitelistProxy } from '~/proxies/query-whitelist'
import { urlPeekProxy } from '~/proxies/url-peek'

export function proxy(request: NextRequest) {
  // proxy in this array will be applied in order
  const proxyFunctions = [avoidScanProxy, oopsProxy, queryWhitelistProxy, urlPeekProxy]

  return applyProxy(proxyFunctions, request)
}
