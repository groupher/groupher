import { proxy } from 'valtio'

import type { TInit, TStore } from './spec'

export default function ArticleStore(init: TInit = {}): TStore {
  const initialStore: TStore = {
    // docs
    isFAQArticleLayout: true,
    ...init,

    commit: (patch: Partial<TStore>): void => {
      Object.assign(store, patch)
    },
  }

  const store = proxy(initialStore)
  return store
}
