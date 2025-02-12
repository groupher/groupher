import { proxy } from 'valtio'
import { mergeLeft, mergeDeepRight } from 'ramda'

import { mergeRight } from 'ramda'

import type { TCommunity } from '~/spec'
import METRIC from '~/const/metric'
import { ARTICLE_THREAD } from '~/const/thread'

import type { TStore, TInit } from './spec'

export default (init: TInit = {}): TStore => {
  const store = proxy(
    mergeLeft(init, {
      metric: METRIC.COMMUNITY,

      user: init.user || null,
      community: init.community || null,
      post: init.post || null,
      changelog: init.changelog || null,
      activeThread: init.activeThread || ARTICLE_THREAD.POST,

      tags: [],
      activeTag: null,

      // TOOD: remove?
      viewingThread: null,
      communityDigestInView: true,

      // docs
      isArticleLayout: false,
      isFAQArticleLayout: true,

      // actions
      updateViewingCommunity(args: TCommunity): void {
        store.community = mergeRight(store.community, args)
      },

      commit: (patch: Partial<TStore>): void => {
        Object.assign(store, mergeDeepRight(store, patch))
      },
    }),
  )
  return store
}
