import { ARTICLE_CAT, ARTICLE_ORDER } from '~/const/gtd'
import type { TArticleFilter } from '~/spec'

import setupStore from '..'

describe('stores/articleList', () => {
  it('updates active filters only when keys exist and supports commit with complex data', () => {
    const store = setupStore()

    expect(store.activeCat).toBeNull()
    expect(store.activeOrder).toBeNull()

    store.updateActiveFilter({ cat: ARTICLE_CAT.BUG } satisfies TArticleFilter)
    expect(store.activeCat).toBe(ARTICLE_CAT.BUG)
    expect(store.activeOrder).toBeNull()

    // only order updates; cat remains
    store.updateActiveFilter({ order: ARTICLE_ORDER.UPVOTES } satisfies TArticleFilter)
    expect(store.activeCat).toBe(ARTICLE_CAT.BUG)
    expect(store.activeOrder).toBe(ARTICLE_ORDER.UPVOTES)
  })
})
