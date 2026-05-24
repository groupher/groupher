import setupStore from '..'

describe('stores/ThemePreset', () => {
  it('clears old mirrored token keys when hydrating a smaller token payload', () => {
    const store = setupStore({
      themeTokens: {
        pageBg: '#ffffff',
        primaryColor: '#111111',
      },
    })

    store.hydrate({
      themeTokens: {
        pageBg: '#eeeeee',
      },
    })

    expect(store.themeTokens).toEqual({ pageBg: '#eeeeee' })
    expect(store.pageBg).toBe('#eeeeee')
    expect((store as unknown as Record<string, unknown>).primaryColor).toBeUndefined()
  })
})
