import type { NextRequest } from 'next/server'

import {
  applyProxy,
  authCookieProxy,
  avoidScanProxy,
  oopsProxy,
  queryWhitelistProxy,
  urlPeekProxy,
} from '~/app/proxies'

import { docMarkdownProxy } from './app/proxies/doc-markdown'

export async function proxy(request: NextRequest) {
  const markdownResponse = docMarkdownProxy(request)
  if (markdownResponse) return markdownResponse

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
