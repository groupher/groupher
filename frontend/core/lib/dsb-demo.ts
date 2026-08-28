import { ROUTE } from '~/const/route'
import { FIELDS } from '~/stores/dsb/constant'
import type { TDsbFieldMap } from '~/stores/dsb/spec'
import { DSB_DEMO_KEY } from '~/unit/DsbThread/constant'
import persist from '~/utils/persist'

const DEMO_CONFIG_KEY = `${DSB_DEMO_KEY}:config`
const DEMO_SNAPSHOT_KEY = `${DSB_DEMO_KEY}:snapshot`

/**
 * Checks whether the dashboard should run against local demo persistence.
 *
 * Demo mode is limited to `/home?mode=demo` so ordinary community dashboards do
 * not accidentally read localStorage overrides.
 */
export const isDsbDemoMode = (
  community: string | null | undefined,
  mode?: string | null,
): boolean => community === ROUTE.HOME && mode === 'demo'

/**
 * Builds a complete dashboard field map from a partial demo payload.
 */
export const buildDsbDemoConfig = (source: Partial<TDsbFieldMap>): TDsbFieldMap => {
  const base = { ...FIELDS, ...source }

  return Object.keys(FIELDS).reduce((acc, key) => {
    // @ts-expect-error
    acc[key as keyof TDsbFieldMap] = base[key as keyof TDsbFieldMap]
    return acc
  }, {} as TDsbFieldMap)
}

/**
 * Reads the editable demo dashboard state from localStorage.
 */
export const getDsbDemoConfig = (fallback?: TDsbFieldMap): TDsbFieldMap | null =>
  persist.get<TDsbFieldMap>(DEMO_CONFIG_KEY, fallback)

/**
 * Persists the editable demo dashboard state.
 */
export const setDsbDemoConfig = (config: TDsbFieldMap): void =>
  persist.set<TDsbFieldMap>(DEMO_CONFIG_KEY, config)

/**
 * Reads the reset snapshot captured before the demo was edited.
 */
export const getDsbDemoSnapshot = (fallback?: TDsbFieldMap): TDsbFieldMap | null =>
  persist.get<TDsbFieldMap>(DEMO_SNAPSHOT_KEY, fallback)

/**
 * Stores the reset snapshot for the demo dashboard.
 */
export const setDsbDemoSnapshot = (config: TDsbFieldMap): void =>
  persist.set<TDsbFieldMap>(DEMO_SNAPSHOT_KEY, config)

/**
 * Restores the editable demo config from its original snapshot.
 */
export const resetDsbDemoConfig = (): TDsbFieldMap | null => {
  const snapshot = getDsbDemoSnapshot()
  if (!snapshot) return null
  setDsbDemoConfig(snapshot)
  return snapshot
}
