import type { NextRequest } from 'next/server'

import {
  applyProxy,
  avoidScanProxy,
  oopsProxy,
  queryWhitelistProxy,
  urlPeekProxy,
} from '~/app/proxies'

export async function proxy(request: NextRequest) {
  // proxy in this array will be applied in order
  const proxyFunctions = [avoidScanProxy, oopsProxy, queryWhitelistProxy, urlPeekProxy]

  return await applyProxy(proxyFunctions, request)
}
