import { ARTICLE_CAT, ARTICLE_ORDER, ARTICLE_STATE } from '~/const/gtd'
import type { TArticleFilter, TPagedArticles, TTag } from '~/spec'

import setupStore from '..'

describe('stores/articleList', () => {
  it('updates active filters only when keys exist and supports commit with complex data', () => {
    const store = setupStore()

    expect(store.activeCat).toBeNull()
    expect(store.activeOrder).toBeNull()
    expect(store.activeState).toBeNull()

    store.updateActiveFilter({ cat: ARTICLE_CAT.BUG } satisfies TArticleFilter)
    expect(store.activeCat).toBe(ARTICLE_CAT.BUG)
    expect(store.activeOrder).toBeNull()

    // only order updates; cat remains
    store.updateActiveFilter({ order: ARTICLE_ORDER.UPVOTES } satisfies TArticleFilter)
    expect(store.activeCat).toBe(ARTICLE_CAT.BUG)
    expect(store.activeOrder).toBe(ARTICLE_ORDER.UPVOTES)

    // edge: key exists but value is undefined -> should assign undefined
    store.updateActiveFilter({ state: ARTICLE_STATE.TODO } satisfies TArticleFilter)
    expect(store.activeState).toBe(ARTICLE_STATE.TODO)

    // edge: key exists but value is undefined -> should assign undefined
    store.updateActiveFilter({ state: undefined } satisfies TArticleFilter)
    expect(store).toHaveProperty('activeState', undefined)

    const paged: TPagedArticles = {
      pageNumber: 1,
      pageSize: 20,
      totalCount: 2,
      totalPages: 1,
      entries: [{ id: 'a1' }, { id: 'a2' }],
    }

    const tags: TTag[] = [
      { id: 't1', title: 'tag-1' },
      { id: 't2', title: 'tag-2' },
    ]

    store.commit({
      tags,
      pagedPosts: paged,
      backlog: { ...paged, entries: [{ id: 'a0' }] },
      todo: paged,
      wip: { ...paged, entries: [] },
      done: { ...paged, entries: [{ id: 'a2' }] },
      rejected: { ...paged, entries: [{ id: 'a3' }] },
    })

    expect(store.pagedPosts.entries).toHaveLength(2)
    expect(store.backlog.entries).toHaveLength(1)
    expect(store.todo.entries).toHaveLength(2)
    expect(store.wip.entries).toHaveLength(0)
    expect(store.done.entries).toHaveLength(1)
    expect(store.rejected.entries).toHaveLength(1)
  })
})
