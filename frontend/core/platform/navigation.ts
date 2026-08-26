'use client'

import { useRouteScope } from './context'

/** Exposes pathname state and actions through the shared React hook boundary. */
export const usePathname = (): string => useRouteScope().navi.location.pathname

/** Exposes search params state and actions through the shared React hook boundary. */
export const useSearchParams = (): URLSearchParams => useRouteScope().navi.location.searchParams

/** Exposes router state and actions through the shared React hook boundary. */
export const useRouter = () => {
  const { navi } = useRouteScope()

  return {
    back: navi.back,
    forward: navi.forward,
    prefetch: navi.prefetch,
    push: navi.push,
    refresh: navi.refresh,
    replace: navi.replace,
  }
}
