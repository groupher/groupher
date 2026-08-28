import { createRouter } from '@tanstack/react-router'

import NotFound from './NotFound'
import { routeTree } from './routeTree.gen'

/** Creates the Landing TanStack router. */
export function getRouter() {
  const options = {
    routeTree,
    scrollRestoration: true,
    trailingSlash: 'never',
    defaultNotFoundComponent: NotFound,
  }

  return createRouter(options as unknown as Parameters<typeof createRouter>[0])
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
