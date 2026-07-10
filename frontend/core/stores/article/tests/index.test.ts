import METRIC from '~/const/metric'
import { THREAD } from '~/const/thread'
import type { TChangelog, TDoc, TPost, TTag } from '~/spec'

import setupStore from '..'

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
    const doc: TDoc = {
      id: 'd1',
      innerId: '300',
      title: 'Doc title',
    }

    const tags: TTag[] = [{ id: 't1', title: 'Edge', color: 'red' }]

    store.commit({
      thread: THREAD.POST,
      post,
      changelog,
      doc,
      tags,
      isArticleLayout: true,
      isFAQArticleLayout: false,
    })

    expect(store.article?.id).toBe('p1')

    store.commit({ thread: THREAD.CHANGELOG })
    expect(store.article?.id).toBe('c1')

    store.commit({ thread: THREAD.DOC })
    expect(store.article?.id).toBe('d1')

    store.commit({ thread: null })
    expect(store.article).toBeNull()
  })
})
