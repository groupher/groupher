import { proxy } from 'valtio'
import { mergeLeft, mergeDeepRight, has } from 'ramda'

import type { TResState, TArticleFilter } from '~/spec'
import { EMPTY_PAGED_ARTICLES } from '~/const/utils'
import TYPE from '~/const/type'
import URL_PARAM from '~/const/url_param'

import type { TStore, TInit } from './spec'

export default (init: TInit = {}): TStore => {
  const store = proxy(
    mergeLeft(init, {
      pagedPosts: EMPTY_PAGED_ARTICLES,
      pagedChangelogs: EMPTY_PAGED_ARTICLES,

      // kanban's
      todo: EMPTY_PAGED_ARTICLES,
      wip: EMPTY_PAGED_ARTICLES,
      done: EMPTY_PAGED_ARTICLES,

      activeOrder: null,
      activeCat: null,
      activeState: null,

      resState: TYPE.RES_STATE.EMPTY as TResState,

      updateActiveFilter(filter: TArticleFilter): void {
        if (has(URL_PARAM.CAT, filter)) store.activeCat = filter.cat
        if (has(URL_PARAM.STATE, filter)) store.activeState = filter.state
        if (has(URL_PARAM.ORDER, filter)) store.activeOrder = filter.order
      },

      commit: (patch: Partial<TStore>): void => {
        Object.assign(store, mergeDeepRight(store, patch))
      },
    }),
  )

  return store
}
