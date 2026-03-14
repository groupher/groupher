import { proxy } from 'valtio'
import type { TInit, TStore } from './spec'

export default function CommunityStore(init: TInit = { slug: 'home' }): TStore {
  const store = proxy({
    title: init.title || '',
    id: init.id || '',
    index: init.index || 0,
    logo: init.logo || '',
    slug: init.slug || '',
    locale: init.locale || '',
    homepage: init.homepage || '',
    subscribersCount: init.subscribersCount || 0,
    articlesCount: init.articlesCount || 0,
    viewerHasSubscribed: init.viewerHasSubscribed || false,
    contributesDigest: init.contributesDigest || [],
    moderatorsCount: init.moderatorsCount || 0,
    desc: init.desc || '',
    meta: init.meta || {},
    threads: init.threads || [],
    pending: init.pending || 0,
    moderators: init.moderators || [],
    views: init.views || 0,

    communityDigestInView: true,

    ...init,

    commit: (patch: Partial<TStore>): void => {
      Object.assign(store, patch)
    },
  })

  return store
}
