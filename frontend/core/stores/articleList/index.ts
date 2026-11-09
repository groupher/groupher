import { has } from 'ramda'
import { proxy } from 'valtio'

import URL_PARAM from '~/const/url_param'
import type { TArticleFilter } from '~/spec'

import type { TInit, TStore } from './spec'

/** Creates an isolated reactive store for the active Article-list thread and filters. */
export default function createArticleListStore(init: TInit = {}): TStore {
  const initialStore: TStore = {
    thread: null,
    activeOrder: null,
    activeCat: null,

    updateActiveFilter(filter: TArticleFilter): void {
      if (has(URL_PARAM.CAT, filter)) store.activeCat = filter.cat
      if (has(URL_PARAM.ORDER, filter)) store.activeOrder = filter.order
    },
    ...init,

    commit: (patch: Partial<TStore>): void => {
      Object.assign(store, patch)
    },
  }

  const store = proxy(initialStore)
  return store
}
