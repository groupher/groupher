import type { NextRequest } from 'next/server'

import { applyMiddleware } from './middlewares/helper'
// import { themeMiddleware } from './middlewares/theme'
import { queryWhitelistMiddleware } from './middlewares/query-whitelist'
import { oopsMiddleware } from './middlewares/oops'
import { avoidScanMiddleware } from './middlewares/avoid-scan'

export function middleware(request: NextRequest) {
  // middleware in this array will be applied in order
  const middlewareFunctions = [
    avoidScanMiddleware,
    oopsMiddleware,
    queryWhitelistMiddleware,
    // ... more middlewares
  ]

  return applyMiddleware(middlewareFunctions, request)
}
