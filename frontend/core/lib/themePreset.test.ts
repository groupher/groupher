import THEME from '~/const/theme'
import type { TResolvedThemePreset } from '~/spec'

import { buildThemePresetCssVars, getThemePresetPageBgCssVar, getThemePresetSection } from './themePreset'

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

describe('getThemePresetSection', () => {
  it('reads the concrete light or dark token section', () => {
    expect(getThemePresetSection(tokens, THEME.LIGHT).textTitle).toBe('#111111')
    expect(getThemePresetSection(tokens, THEME.DARK).textTitle).toBe('#eeeeee')
  })
})

describe('getThemePresetPageBgCssVar', () => {
  it('returns the css variable fallback for one concrete theme', () => {
    expect(getThemePresetPageBgCssVar(THEME.LIGHT)).toBe('var(--color-page-custom)')
    expect(getThemePresetPageBgCssVar(THEME.DARK)).toBe('var(--color-page-custom-dark)')
  })
})

describe('buildThemePresetCssVars', () => {
  it('builds css variables from backend resolved tokens for the requested theme', () => {
    expect(buildThemePresetCssVars(tokens, THEME.LIGHT)['--color-title']).toBe('#111111')
    expect(buildThemePresetCssVars(tokens, THEME.DARK)['--color-title']).toBe('#eeeeee')
    expect(buildThemePresetCssVars(tokens, THEME.DARK)['--color-card']).toBe('#202020')
  })
})
