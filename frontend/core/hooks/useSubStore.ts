import { useSnapshot } from 'valtio'

import { useStore } from '~/stores'
import type { TTreeStoreKey, TTreeStore } from '~/stores/spec'

export default <K extends TTreeStoreKey>(tree: K): TTreeStore<K> => {
  const root = useStore() // 使用新的 useStore 而不是直接 useContext
  const snap = useSnapshot(root)

  // @ts-ignore
  return snap[tree]
}
