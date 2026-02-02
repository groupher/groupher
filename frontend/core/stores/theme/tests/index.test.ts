import THEME, { THEME_MODE } from '~/const/theme'

import setupStore from '..'

describe('stores/theme', () => {
  it('changes theme and themeMode', () => {
    const store = setupStore()

    expect(store.theme).toBe(THEME.LIGHT)
    expect(store.themeMode).toBe(THEME_MODE.SYSTEM)

    store.change(THEME.DARK)
    expect(store.theme).toBe(THEME.DARK)

    store.changeMode(THEME_MODE.DARK)
    expect(store.themeMode).toBe(THEME_MODE.DARK)
  })
})
