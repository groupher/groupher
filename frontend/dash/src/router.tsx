import { createRouter as createTanStackRouter } from '@tanstack/react-router'

import RouteError from './components/RouteError'
import RoutePending from './components/RoutePending'
import { routeTree } from './routeTree.gen'

/** Returns router for the frontend shared workflow. */
export function getRouter() {
  const options = {
    routeTree,
    scrollRestoration: true,
    defaultErrorComponent: RouteError,
    defaultPendingComponent: RoutePending,
    defaultPendingMs: 250,
    defaultPendingMinMs: 300,
  }

  // TanStack Router's option type requires strictNullChecks; Dash keeps the
  // existing migration-wide tsconfig setting, so contain the boundary cast here.
  return createTanStackRouter(options as unknown as Parameters<typeof createTanStackRouter>[0])
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
