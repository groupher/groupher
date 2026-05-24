import THEME from '~/const/theme'
import type { TResolvedThemePreset } from '~/spec'

import { buildThemePresetCssVars, getThemePresetValue } from './themePreset'

const tokens: TResolvedThemePreset = {
  pageBg: '#ffffff',
  pageBgDark: '#101010',
  pageBgHue: 0,
  pageBgHueDark: 0,
  pageBgIntensity: 0,
  pageBgIntensityDark: 0,
  primaryColor: '#112233',
  primaryColorDark: '#223344',
  accentColor: '#334455',
  accentColorDark: '#445566',
  textTitle: '#111111',
  textTitleDark: '#eeeeee',
  textDigest: '#666666',
  textDigestDark: '#aaaaaa',
  cardColor: '#ffffff',
  cardColorDark: '#202020',
  dividerColor: '#dddddd',
  dividerColorDark: '#333333',
  gaussBlur: 100,
  gaussBlurDark: 100,
  glowType: '',
  glowTypeDark: '',
  glowFixed: true,
  glowOpacity: 100,
  glowOpacityDark: 100,
}

describe('getThemePresetValue', () => {
  it('reads dark keys from a base key by convention', () => {
    expect(getThemePresetValue(tokens, 'textTitle', THEME.LIGHT)).toBe('#111111')
    expect(getThemePresetValue(tokens, 'textTitle', THEME.DARK)).toBe('#eeeeee')
  })
})

describe('buildThemePresetCssVars', () => {
  it('builds css variables from backend resolved tokens for the requested theme', () => {
    expect(buildThemePresetCssVars(tokens, THEME.LIGHT)['--color-title']).toBe('#111111')
    expect(buildThemePresetCssVars(tokens, THEME.DARK)['--color-title']).toBe('#eeeeee')
    expect(buildThemePresetCssVars(tokens, THEME.DARK)['--color-card']).toBe('#202020')
  })
})
