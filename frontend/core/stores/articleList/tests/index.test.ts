import { ARTICLE_CAT, ARTICLE_ORDER, ARTICLE_STATUS } from '~/const/gtd'
import type { TArticleFilter } from '~/spec'

import setupStore from '..'

describe('stores/articleList', () => {
  it('updates active filters only when keys exist and supports commit with complex data', () => {
    const store = setupStore()

    expect(store.activeCat).toBeNull()
    expect(store.activeOrder).toBeNull()
    expect(store.activeStatus).toBeNull()

    store.updateActiveFilter({ cat: ARTICLE_CAT.BUG } satisfies TArticleFilter)
    expect(store.activeCat).toBe(ARTICLE_CAT.BUG)
    expect(store.activeOrder).toBeNull()

    // only order updates; cat remains
    store.updateActiveFilter({ order: ARTICLE_ORDER.UPVOTES } satisfies TArticleFilter)
    expect(store.activeCat).toBe(ARTICLE_CAT.BUG)
    expect(store.activeOrder).toBe(ARTICLE_ORDER.UPVOTES)

    // edge: key exists but value is undefined -> should assign undefined
    store.updateActiveFilter({ status: ARTICLE_STATUS.TODO } satisfies TArticleFilter)
    expect(store.activeStatus).toBe(ARTICLE_STATUS.TODO)

    // edge: key exists but value is undefined -> should assign undefined
    store.updateActiveFilter({ status: undefined } satisfies TArticleFilter)
    expect(store).toHaveProperty('activeStatus', undefined)
  })
})
