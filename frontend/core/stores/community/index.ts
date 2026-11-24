import { proxy } from 'valtio'

import { COMMUNITY_THREADS } from '~/const/thread'

import type { TInit, TStore } from './spec'

/** Creates an isolated reactive store for one Community's identity and aggregate metadata. */
export default function createCommunityStore(init: TInit = { slug: 'home' }): TStore {
  const store = proxy({
    ...init,
    title: init.title || '',
    id: init.id || '',
    index: init.index || 0,
    logo: init.logo || '',
    slug: init.slug || '',
    locale: init.locale || '',
    homepage: init.homepage || '',
    subscribersCount: init.subscribersCount || 0,
    articlesCount: init.articlesCount || 0,
    contributesDigest: init.contributesDigest || [],
    moderatorsCount: init.moderatorsCount || 0,
    desc: init.desc || '',
    meta: init.meta || {},
    threads: init.threads || [...COMMUNITY_THREADS],
    pending: init.pending || 0,
    views: init.views || 0,

    hydrate: (confirmed: TInit): void => {
      Object.assign(store, confirmed)
    },
  })

  return store
}
