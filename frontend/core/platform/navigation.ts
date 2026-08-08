'use client'

import { usePlatform } from './context'

export const usePathname = (): string => usePlatform().navi.location.pathname

export const useSearchParams = (): URLSearchParams => usePlatform().navi.location.searchParams

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
