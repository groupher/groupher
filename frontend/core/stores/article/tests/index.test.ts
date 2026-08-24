import setupStore from '..'

describe('stores/article', () => {
  it('owns only article-local UI state', () => {
    const store = setupStore()

    store.commit({
      isFAQArticleLayout: false,
    })

    expect(store.isFAQArticleLayout).toBe(false)
  })
})
