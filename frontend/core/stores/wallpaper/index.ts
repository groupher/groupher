import { clone } from 'ramda'
import { proxy } from 'valtio'

import { initState } from './helper'
import type { TInit, TStore } from './spec'

export default (init: TInit = {}): TStore => {
  const initialState = initState(init)
  const initialStore: TStore = {
    // Keep the saved baseline isolated from live nested edits used by diff patches.
    original: clone(initialState),
    ...clone(initialState),

    commit: (patch: Partial<TStore>): void => {
      const { light, dark, ...rest } = patch

      Object.assign(store, rest)
      if (light) Object.assign(store.light, light)
      if (dark) Object.assign(store.dark, dark)
    },
  }

  const store = proxy(initialStore)
  return store
}
