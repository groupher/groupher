import { mergeRight } from 'ramda'
import { proxy } from 'valtio'
import METRIC from '~/const/metric'
import { ARTICLE_THREAD } from '~/const/thread'
import type { TCommunity } from '~/spec'

import type { TInit, TStore } from './spec'

export default (init: TInit = {}): TStore => {
  const initialStore: TStore = {
    metric: METRIC.COMMUNITY,

    user: init.user || null,
    community: init.community || null,
    post: init.post || null,
    changelog: init.changelog || null,
    activeThread: init.activeThread || ARTICLE_THREAD.POST,

    tags: [],
    activeTag: null,

    // TODO: remove?
    viewingThread: null,
    communityDigestInView: true,

    // docs
    isArticleLayout: false,
    isFAQArticleLayout: true,
    ...init,

    // actions
    updateViewingCommunity(args: TCommunity): void {
      store.community = mergeRight(store.community, args)
    },

    commit: (patch: Partial<TStore>): void => {
      Object.assign(store, patch)
    },
  }

  const store = proxy(initialStore)
  return store
}
