import { createRouter } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'

/** Creates the Inspire Me application router. */
export function getRouter() {
  const options = {
    routeTree,
    trailingSlash: 'never',
    scrollRestoration: true,
    defaultPendingMs: 200,
    defaultPendingMinMs: 250,
  }

  return createRouter(options as unknown as Parameters<typeof createRouter>[0])
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
