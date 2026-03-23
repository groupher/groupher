import { ROUTE } from '~/const/route'
import { DSB_DEMO_KEY } from '~/unit/dashboard-thread/constant'
import { FIELDS } from '~/stores/dashboard/constant'
import type { TDsbFieldMap } from '~/stores/dashboard/spec'
import persist from '~/utils/persist'

const DEMO_CONFIG_KEY = `${DSB_DEMO_KEY}:config`
const DEMO_SNAPSHOT_KEY = `${DSB_DEMO_KEY}:snapshot`

export const isDsbDemoMode = (community: string | null | undefined, mode?: string | null): boolean =>
  community === ROUTE.HOME && mode === 'demo'

export const buildDsbDemoConfig = (source: Partial<TDsbFieldMap>): TDsbFieldMap => {
  const base = { ...FIELDS, ...source }

  return Object.keys(FIELDS).reduce((acc, key) => {
    // @ts-expect-error
    acc[key as keyof TDsbFieldMap] = base[key as keyof TDsbFieldMap]
    return acc
  }, {} as TDsbFieldMap)
}

export const getDsbDemoConfig = (fallback?: TDsbFieldMap): TDsbFieldMap | null =>
  persist.get<TDsbFieldMap>(DEMO_CONFIG_KEY, fallback)

export const setDsbDemoConfig = (config: TDsbFieldMap): void =>
  persist.set<TDsbFieldMap>(DEMO_CONFIG_KEY, config)

export const getDsbDemoSnapshot = (fallback?: TDsbFieldMap): TDsbFieldMap | null =>
  persist.get<TDsbFieldMap>(DEMO_SNAPSHOT_KEY, fallback)

export const setDsbDemoSnapshot = (config: TDsbFieldMap): void =>
  persist.set<TDsbFieldMap>(DEMO_SNAPSHOT_KEY, config)

export const resetDsbDemoConfig = (): TDsbFieldMap | null => {
  const snapshot = getDsbDemoSnapshot()
  if (!snapshot) return null
  setDsbDemoConfig(snapshot)
  return snapshot
}
