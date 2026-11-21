import persist from '~/lib/persist'

import type { TDsbEditableFields } from './spec'

const demoFieldsKey = (community: string): string => `dsb:demo:${community}`

/** Reads the locally persisted Dsb draft for a demo community. */
export const readDemoFields = (community: string): Partial<TDsbEditableFields> =>
  persist.get<Partial<TDsbEditableFields>>(demoFieldsKey(community), {}) ?? {}

/** Persists one demo Dsb save patch locally. */
export const writeDemoFields = (community: string, patch: Partial<TDsbEditableFields>): void => {
  persist.set(demoFieldsKey(community), { ...readDemoFields(community), ...patch })
}
