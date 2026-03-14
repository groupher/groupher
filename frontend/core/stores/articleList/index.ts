import { has } from 'ramda'
import { proxy } from 'valtio'
import TYPE from '~/const/type'
import URL_PARAM from '~/const/url_param'
import { EMPTY_PAGED_ARTICLES } from '~/const/utils'
import type { TArticleFilter, TResState } from '~/spec'

import type { TInit, TStore } from './spec'

export default function ArticleListStore(init: TInit = {}): TStore {
  const initialStore: TStore = {
    thread: null,
    pagedPosts: EMPTY_PAGED_ARTICLES,
    pagedChangelogs: EMPTY_PAGED_ARTICLES,

    // kanban's
    backlog: EMPTY_PAGED_ARTICLES,
    todo: EMPTY_PAGED_ARTICLES,
    wip: EMPTY_PAGED_ARTICLES,
    done: EMPTY_PAGED_ARTICLES,
    rejected: EMPTY_PAGED_ARTICLES,

    activeOrder: null,
    activeCat: null,
    activeState: null,

    tags: [],
    activeTag: null,

    resState: TYPE.RES_STATE.EMPTY as TResState,

    updateActiveFilter(filter: TArticleFilter): void {
      if (has(URL_PARAM.CAT, filter)) store.activeCat = filter.cat
      if (has(URL_PARAM.STATE, filter)) store.activeState = filter.state
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
