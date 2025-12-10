import { proxy } from 'valtio'
import TYPE from '~/const/type'
import { EMPTY_PAGED_ARTICLES } from '~/const/utils'
import type { TResState } from '~/spec'

import type { TInit, TStore } from './spec'

export default (init: TInit = {}): TStore => {
  // @ts-expect-error
  const initialStore: TStore = {
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
    ...init,
  }

  const store = proxy(initialStore)
  return store
}
