'use client'

import { usePlatform } from './context'

/** Exposes pathname state and actions through the shared React hook boundary. */
export const usePathname = (): string => usePlatform().navi.location.pathname

/** Exposes search params state and actions through the shared React hook boundary. */
export const useSearchParams = (): URLSearchParams => usePlatform().navi.location.searchParams

/** Exposes router state and actions through the shared React hook boundary. */
export const useRouter = () => {
  const { navi } = usePlatform()

  return {
    back: navi.back,
    forward: navi.forward,
    prefetch: navi.prefetch,
    push: navi.push,
    refresh: navi.refresh,
    replace: navi.replace,
  }
}
