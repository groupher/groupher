import { THEME_PRESET } from '~/const/theme_preset'

import { resolveRawBg } from '../DetailsPanel/CustomPageBg/hooks'
import {
  composeCustomPresetEditFields,
  composeCustomPresetResetFields,
  composePresetSelectionFields,
  mergeThemePresetOverwritePatch,
  toCssOpacity,
} from '../helper'
import type { TThemePresetTokens } from '../spec'

const tokens: TThemePresetTokens = {
  shared: { glowFixed: true },
  light: {
    pageBg: '#ffffff',
    pageBgHue: 42,
    pageBgIntensity: 52,
    primaryColor: '#222222',
    accentColor: '#333333',
    textTitle: '#444444',
    textDigest: '#555555',
    cardColor: '#666666',
    dividerColor: '#777777',
    gaussBlur: 80,
    glowType: 'radial',
    glowOpacity: 70,
  },
  dark: {
    pageBg: '#111111',
    pageBgHue: 318,
    pageBgIntensity: 61,
    primaryColor: '#eeeeee',
    accentColor: '#dddddd',
    textTitle: '#cccccc',
    textDigest: '#bbbbbb',
    cardColor: '#aaaaaa',
    dividerColor: '#999999',
    gaussBlur: 40,
    glowType: 'radial',
    glowOpacity: 30,
  },
}

describe('theme preset model helpers', () => {
  it('normalizes css opacity from dashboard percent', () => {
    expect(toCssOpacity(75)).toBe(0.75)
    expect(toCssOpacity(-10)).toBe(0)
    expect(toCssOpacity(200)).toBe(1)
    expect(toCssOpacity(Number.NaN)).toBe(1)
  })

  it('falls back to the theme css variable when page background draft is empty', () => {
    const draft = {
      pageBg: '',
      pageBgHue: tokens.light.pageBgHue,
      pageBgIntensity: tokens.light.pageBgIntensity,
    }

    expect(resolveRawBg(draft)).toBe('var(--color-page-custom)')
  })

  it('forks readonly preset edits into custom tokens and sparse overwrite', () => {
    const { dashboardFields, nextCustomTokensDraft } = composeCustomPresetEditFields({
      activePreset: THEME_PRESET.CLAUDE,
      activePresetBase: THEME_PRESET.CLAUDE,
      selectedTokens: tokens,
      customTokensDraft: null,
      currentThemeOverwrite: {},
      overwrite: { light: { primaryColor: '#999999' } },
    })

    expect(dashboardFields).toMatchObject({
      themePreset: THEME_PRESET.CUSTOM,
      themePresetBase: THEME_PRESET.CLAUDE,
      themeTokens: nextCustomTokensDraft,
      themeOverwrite: { light: { primaryColor: '#999999' } },
    })
    expect(nextCustomTokensDraft.light.primaryColor).toBe('#999999')
  })

  it('keeps existing custom tokens as the edit base and merges overwrite', () => {
    const customTokensDraft = {
      ...tokens,
      light: { ...tokens.light, primaryColor: '#777777' },
    }
    const { dashboardFields, nextCustomTokensDraft } = composeCustomPresetEditFields({
      activePreset: THEME_PRESET.CUSTOM,
      activePresetBase: THEME_PRESET.CLAUDE,
      selectedTokens: tokens,
      customTokensDraft,
      currentThemeOverwrite: { light: { primaryColor: '#777777' } },
      overwrite: { light: { accentColor: '#888888' } },
    })

    expect(nextCustomTokensDraft.light).toMatchObject({
      primaryColor: '#777777',
      accentColor: '#888888',
    })
    expect(dashboardFields.themeOverwrite).toEqual({
      light: {
        primaryColor: '#777777',
        accentColor: '#888888',
      },
    })
  })

  it('treats nullable custom overwrite as an empty patch container', () => {
    expect(mergeThemePresetOverwritePatch(null, { light: { pageBgHue: 120 } })).toEqual({
      light: { pageBgHue: 120 },
    })
  })

  it('builds preset selection fields for readonly presets', () => {
    const { dashboardFields } = composePresetSelectionFields({
      preset: { value: THEME_PRESET.DEFAULT, tokens },
      currentThemePresetBase: THEME_PRESET.CLAUDE,
      customTokensDraft: null,
    })

    expect(dashboardFields).toMatchObject({
      themePreset: THEME_PRESET.DEFAULT,
      themePresetBase: THEME_PRESET.CLAUDE,
      themeTokens: tokens,
    })
  })

  it('resets custom tokens to the selected preset and clears sparse overwrite', () => {
    const { dashboardFields, nextCustomTokensDraft } = composeCustomPresetResetFields({
      value: THEME_PRESET.SOLARIZED,
      tokens,
    })

    expect(dashboardFields).toMatchObject({
      themePreset: THEME_PRESET.CUSTOM,
      themePresetBase: THEME_PRESET.SOLARIZED,
      themeTokens: nextCustomTokensDraft,
      themeOverwrite: {},
    })
  })
})
