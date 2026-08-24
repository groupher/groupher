import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

import { getQueryClient } from '~/query'

import RouteError from './components/RouteError'
import RoutePending from './components/RoutePending'
import type { TRouterContext } from './router-context'
import { routeTree } from './routeTree.gen'

/** Returns router for the frontend shared workflow. */
export function getRouter() {
  const queryClient = getQueryClient()
  const options = {
    routeTree,
    context: { queryClient } satisfies TRouterContext,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouteError,
    defaultPendingComponent: RoutePending,
    defaultPendingMs: 250,
    defaultPendingMinMs: 300,
  }

  // TanStack Router's option type requires strictNullChecks; Dash keeps the
  // existing migration-wide tsconfig setting, so contain the boundary cast here.
  const router = createTanStackRouter(
    options as unknown as Parameters<typeof createTanStackRouter>[0],
  )

  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
