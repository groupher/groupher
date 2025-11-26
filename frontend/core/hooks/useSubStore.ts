import { useSnapshot } from 'valtio'

import { useStore } from '~/stores'
import type { TTreeStore, TTreeStoreKey } from '~/stores/spec'

export default <K extends TTreeStoreKey>(tree: K): TTreeStore<K> => {
  const root = useStore()
  const snap = useSnapshot(root)

  // @ts-expect-error
  return snap[tree]
}
