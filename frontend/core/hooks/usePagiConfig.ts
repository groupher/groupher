import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'

import { toEffectivePagiConfig } from '~/lib/pagination/params'
import { readPagiMobileLayout } from '~/lib/pagination/viewport'
import type { TPagiPreference } from '~/spec'

export const PaginationDeviceContext = createContext<boolean | null>(null)

const subscribe = () => () => {}
const serverSnapshot = () => null

/** Community shares one request selection across SSR and hydration; other hosts select on mount. */
export default function usePagiConfig(preference: TPagiPreference, scope: string) {
  const requestDevice = useContext(PaginationDeviceContext)
  const snapshot = useMemo(() => {
    // A new collection chooses again; resizing an active collection preserves its position.
    let layout: boolean | null = null
    return () => {
      if (requestDevice !== null) return requestDevice
      layout ??= readPagiMobileLayout()
      return layout
    }
  }, [scope, requestDevice])
  const mobile = useSyncExternalStore(
    subscribe,
    snapshot,
    requestDevice === null ? serverSnapshot : snapshot,
  )
  return { config: toEffectivePagiConfig(preference, mobile === true), ready: mobile !== null }
}
