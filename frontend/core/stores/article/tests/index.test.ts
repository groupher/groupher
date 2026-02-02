import METRIC from '~/const/metric'
import { THREAD } from '~/const/thread'

import setupStore from '..'

import type { TChangelog, TPost, TTag } from '~/spec'

describe('stores/article', () => {
  it('switches article getter by thread and supports edge commits', () => {
    const store = setupStore()

    expect(store.metric).toBe(METRIC.ARTICLE)
    expect(store.thread).toBeNull()
    expect(store.article).toBeNull()

    const post: TPost = {
      id: 'p1',
      innerId: '100',
      title: 'Post title',
    }
    const changelog: TChangelog = {
      id: 'c1',
      innerId: '200',
      title: 'Changelog title',
    }

    const tags: TTag[] = [{ id: 't1', title: 'Edge', color: 'red' }]

    store.commit({
      thread: THREAD.POST,
      post,
      changelog,
      tags,
      isArticleLayout: true,
      isFAQArticleLayout: false,
    })

    expect(store.article?.id).toBe('p1')

    store.commit({ thread: THREAD.CHANGELOG })
    expect(store.article?.id).toBe('c1')

    store.commit({ thread: null })
    expect(store.article).toBeNull()
  })
})
