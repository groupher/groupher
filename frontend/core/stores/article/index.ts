import { proxy } from 'valtio'

import METRIC from '~/const/metric'
import { THREAD } from '~/const/thread'

import type { TInit, TStore } from './spec'

export default function ArticleStore(init: TInit = {}): TStore {
  const initialStore: TStore = {
    metric: METRIC.ARTICLE,
    thread: null,

    post: init.post || null,
    changelog: init.changelog || null,
    doc: init.doc || null,

    tags: [],

    // docs
    isArticleLayout: false,
    isFAQArticleLayout: true,
    ...init,

    get article() {
      switch (this.thread) {
        case THREAD.POST:
          return this.post
        case THREAD.CHANGELOG:
          return this.changelog
        case THREAD.DOC:
          return this.doc
        default:
          return null
      }
    },

    commit: (patch: Partial<TStore>): void => {
      Object.assign(store, patch)
    },
  }

  const store = proxy(initialStore)
  return store
}
