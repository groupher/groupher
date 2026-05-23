import THEME from '~/const/theme'
import { DEFAULT_THEME_PRESET_TOKENS } from '~/const/theme_preset'

import { buildThemePresetCssVars, getThemePresetValue, getThemeTokens } from './themePreset'

describe('getThemeTokens', () => {
  it('uses backend theme tokens as-is over local defaults', () => {
    const tokens = getThemeTokens({
      textTitle: '#111111',
      textTitleDark: '#eeeeee',
      pageBgHue: 420,
    })

    expect(tokens.textTitle).toBe('#111111')
    expect(tokens.textTitleDark).toBe('#eeeeee')
    expect(tokens.pageBgHue).toBe(420)
  })

  it('falls back to default tokens when backend tokens are absent', () => {
    expect(getThemeTokens()).toEqual(DEFAULT_THEME_PRESET_TOKENS)
  })
})

describe('getThemePresetValue', () => {
  it('reads dark keys from a base key by convention', () => {
    const tokens = getThemeTokens({
      textTitle: '#111111',
      textTitleDark: '#eeeeee',
    })

    expect(getThemePresetValue(tokens, 'textTitle', THEME.LIGHT)).toBe('#111111')
    expect(getThemePresetValue(tokens, 'textTitle', THEME.DARK)).toBe('#eeeeee')
  })
})

describe('buildThemePresetCssVars', () => {
  it('builds css variables for the requested theme', () => {
    const tokens = getThemeTokens({
      textTitle: '#111111',
      textTitleDark: '#eeeeee',
      cardColor: '#ffffff',
      cardColorDark: '#202020',
    })

    expect(buildThemePresetCssVars(tokens, THEME.LIGHT)['--color-title']).toBe('#111111')
    expect(buildThemePresetCssVars(tokens, THEME.DARK)['--color-title']).toBe('#eeeeee')
    expect(buildThemePresetCssVars(tokens, THEME.DARK)['--color-card']).toBe('#202020')
  })
})
