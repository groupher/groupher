import type { TResolvedThemePreset } from '~/spec'

import { composeThemePresetCssVars, THEME_PRESET_PAGE_BG_CSS_VAR } from './themePreset'

const tokens: TResolvedThemePreset = {
  shared: { glowFixed: true },
  light: {
    pageBg: '#ffffff',
    pageBgHue: 0,
    pageBgIntensity: 0,
    primaryColor: '#112233',
    accentColor: '#334455',
    textTitle: '#111111',
    textDigest: '#666666',
    cardColor: '#ffffff',
    dividerColor: '#dddddd',
    gaussBlur: 100,
    glowType: '',
    glowOpacity: 100,
  },
  dark: {
    pageBg: '#101010',
    pageBgHue: 0,
    pageBgIntensity: 0,
    primaryColor: '#223344',
    accentColor: '#445566',
    textTitle: '#eeeeee',
    textDigest: '#aaaaaa',
    cardColor: '#202020',
    dividerColor: '#333333',
    gaussBlur: 100,
    glowType: '',
    glowOpacity: 100,
  },
}

describe('THEME_PRESET_PAGE_BG_CSS_VAR', () => {
  it('holds the active page background css variable fallback', () => {
    expect(THEME_PRESET_PAGE_BG_CSS_VAR).toBe('var(--color-page-custom)')
  })
})

describe('composeThemePresetCssVars', () => {
  it('builds css variables from backend resolved tokens for the requested theme', () => {
    const lightVars = composeThemePresetCssVars(tokens, 'light')
    const darkVars = composeThemePresetCssVars(tokens, 'dark')

    expect(lightVars['--color-title']).toBe('#111111')
    expect(darkVars['--color-title']).toBe('#eeeeee')
    expect(darkVars['--color-card']).toBe('#202020')
    expect(lightVars['--color-page-custom']).toBe('#ffffff')
    expect(darkVars['--color-page-custom']).toBe('#101010')

    for (const key of [
      '--color-primary-custom-dark',
      '--color-accent-custom-dark',
      '--color-page-custom-dark',
      '--color-title-dark',
      '--color-digest-dark',
      '--color-card-dark',
      '--color-divider-dark',
    ]) {
      expect(darkVars).not.toHaveProperty(key)
    }
  })
})
