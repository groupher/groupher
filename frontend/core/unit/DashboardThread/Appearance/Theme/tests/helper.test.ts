import { THEME_PRESET } from '~/const/theme_preset'

import { resolveRawBg } from '../DetailsPanel/CustomPageBg/hooks'
import {
  buildCustomPresetEditOverwrite,
  buildCustomPresetResetOverwrite,
  buildPresetSelectionFields,
  toCssOpacity,
  toPageBgDraft,
} from '../helper'
import type { TThemePresetTokens } from '../spec'

const tokens: TThemePresetTokens = {
  pageBg: '#ffffff',
  pageBgDark: '#111111',
  pageBgHue: 42,
  pageBgHueDark: 318,
  pageBgIntensity: 52,
  pageBgIntensityDark: 61,
  primaryColor: '#222222',
  primaryColorDark: '#eeeeee',
  accentColor: '#333333',
  accentColorDark: '#dddddd',
  textTitle: '#444444',
  textTitleDark: '#cccccc',
  textDigest: '#555555',
  textDigestDark: '#bbbbbb',
  cardColor: '#666666',
  cardColorDark: '#aaaaaa',
  dividerColor: '#777777',
  dividerColorDark: '#999999',
  gaussBlur: 80,
  gaussBlurDark: 40,
  glowType: 'radial',
  glowTypeDark: 'radial',
  glowFixed: true,
  glowOpacity: 70,
  glowOpacityDark: 30,
}

describe('theme preset model helpers', () => {
  it('normalizes css opacity from dashboard percent', () => {
    expect(toCssOpacity(75)).toBe(0.75)
    expect(toCssOpacity(-10)).toBe(0)
    expect(toCssOpacity(200)).toBe(1)
    expect(toCssOpacity(Number.NaN)).toBe(1)
  })

  it('adapts theme tokens to page background drafts', () => {
    expect(toPageBgDraft(tokens)).toEqual({
      pageBg: tokens.pageBg,
      pageBgDark: tokens.pageBgDark,
      pageBgHue: tokens.pageBgHue,
      pageBgHueDark: tokens.pageBgHueDark,
      pageBgIntensity: tokens.pageBgIntensity,
      pageBgIntensityDark: tokens.pageBgIntensityDark,
    })
  })

  it('falls back to the theme css variable when page background draft is empty', () => {
    const draft = { ...toPageBgDraft(tokens), pageBg: '', pageBgDark: '' }

    expect(resolveRawBg(draft, true)).toBe('var(--color-page-custom)')
    expect(resolveRawBg(draft, false)).toBe('var(--color-page-custom-dark)')
  })

  it('forks readonly preset edits into custom tokens and sparse overwrite', () => {
    const { dashboardFields, nextCustomTokensDraft } = buildCustomPresetEditOverwrite({
      activePreset: THEME_PRESET.CLAUDE,
      activePresetBase: THEME_PRESET.CLAUDE,
      selectedTokens: tokens,
      customTokensDraft: null,
      currentThemeOverwrite: {},
      overwrite: { primaryColor: '#999999' },
    })

    expect(dashboardFields).toMatchObject({
      themePreset: THEME_PRESET.CUSTOM,
      themePresetBase: THEME_PRESET.CLAUDE,
      themeTokens: nextCustomTokensDraft,
      themeOverwrite: { primaryColor: '#999999' },
    })
    expect(nextCustomTokensDraft.primaryColor).toBe('#999999')
  })

  it('keeps existing custom tokens as the edit base and merges overwrite', () => {
    const customTokensDraft = { ...tokens, primaryColor: '#777777' }
    const { dashboardFields, nextCustomTokensDraft } = buildCustomPresetEditOverwrite({
      activePreset: THEME_PRESET.CUSTOM,
      activePresetBase: THEME_PRESET.CLAUDE,
      selectedTokens: tokens,
      customTokensDraft,
      currentThemeOverwrite: { primaryColor: '#777777' },
      overwrite: { accentColor: '#888888' },
    })

    expect(nextCustomTokensDraft).toMatchObject({
      primaryColor: '#777777',
      accentColor: '#888888',
    })
    expect(dashboardFields.themeOverwrite).toEqual({
      primaryColor: '#777777',
      accentColor: '#888888',
    })
  })

  it('builds preset selection fields for readonly presets', () => {
    const { dashboardFields } = buildPresetSelectionFields({
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
    const { dashboardFields, nextCustomTokensDraft } = buildCustomPresetResetOverwrite({
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
