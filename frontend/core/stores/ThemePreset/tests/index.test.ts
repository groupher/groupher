import type { TResolvedThemePreset } from '~/spec'

import setupStore from '..'

const makeTokens = (pageBg: string): TResolvedThemePreset => ({
  shared: { glowFixed: true },
  light: {
    pageBg,
    pageBgHue: 0,
    pageBgIntensity: 0,
    primaryColor: '#111111',
    accentColor: '#222222',
    textTitle: '#333333',
    textDigest: '#444444',
    cardColor: '#ffffff',
    dividerColor: '#dddddd',
    gaussBlur: 100,
    glowType: '',
    glowOpacity: 100,
  },
  dark: {
    pageBg: '#111111',
    pageBgHue: 0,
    pageBgIntensity: 0,
    primaryColor: '#eeeeee',
    accentColor: '#dddddd',
    textTitle: '#cccccc',
    textDigest: '#bbbbbb',
    cardColor: '#222222',
    dividerColor: '#333333',
    gaussBlur: 100,
    glowType: '',
    glowOpacity: 100,
  },
})

describe('stores/ThemePreset', () => {
  it('replaces theme tokens without creating flat mirrored keys', () => {
    const nextTokens = makeTokens('#eeeeee')
    const store = setupStore({
      themeTokens: makeTokens('#ffffff'),
    })

    store.hydrate({
      themeTokens: nextTokens,
    })

    expect(store.themeTokens).toEqual(nextTokens)
    expect((store as unknown as Record<string, unknown>).pageBg).toBeUndefined()
    expect((store as unknown as Record<string, unknown>).primaryColor).toBeUndefined()
  })
})
