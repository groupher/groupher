import METRIC from '~/const/metric'
import { ARTICLE_THREAD } from '~/const/thread'

import setupStore from '..'

import type { TCommunity, TTag } from '~/spec'
import type { TInit } from '~/stores/viewing/spec'

describe('stores/viewing', () => {
  it('merges community updates and supports commit with edge data', () => {
    const community: TCommunity = {
      id: 'c1',
      slug: 'acme',
      title: 'ACME',
      meta: { postsCount: 1 },
    }

    const init: TInit = {
      metric: METRIC.COMMUNITY,
      community,
      activeThread: ARTICLE_THREAD.POST,
    }

    const store = setupStore(init)

    expect(store.community?.slug).toBe('acme')

    const updatedCommunity: TCommunity = {
      ...community,
      title: 'ACME v2',
      meta: { docsCount: 2 },
    }

    store.updateViewingCommunity(updatedCommunity)

    expect(store.community?.title).toBe('ACME v2')
    // mergeRight is shallow, so nested meta is replaced
    expect(store.community?.meta).toEqual({ docsCount: 2 })

    const tags: TTag[] = [{ id: 't1', title: 'X' }]

    store.commit({
      activeThread: ARTICLE_THREAD.CHANGELOG,
      tags,
      communityDigestInView: false,
    })

    expect(store.activeThread).toBe(ARTICLE_THREAD.CHANGELOG)
    expect(store.tags).toHaveLength(1)
    expect(store.communityDigestInView).toBe(false)
  })
})
