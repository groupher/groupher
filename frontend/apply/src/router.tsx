import { createRouter } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'

/** Returns router for the frontend shared workflow. */
export function getRouter() {
  return createRouter({
    routeTree,
    basepath: '/apply',
    trailingSlash: 'never',
    scrollRestoration: true,
    defaultPendingMs: 200,
    defaultPendingMinMs: 250,
  } as any)
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
