import { THEME_PRESET } from '~/const/theme_preset'

import {
  buildCustomPresetEditPatch,
  buildCustomPresetResetPatch,
  buildPresetSelectionPatch,
  pickDashboardMirrorPatch,
  toCssOpacity,
  toPageBgDraft,
} from '../helper'
import type { TThemePresetOverwrite } from '../spec'

const overwrite: TThemePresetOverwrite = {
  pageBg: '#ffffff',
  pageBgDark: '#111111',
  primaryColor: '#222222',
  primaryColorDark: '#eeeeee',
  accentColor: '#333333',
  accentColorDark: '#dddddd',
  textTitle: '#444444',
  textTitleDark: '#cccccc',
  textDigest: '#555555',
  textDigestDark: '#bbbbbb',
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
    expect(toPageBgDraft(overwrite)).toEqual({
      pageBg: overwrite.pageBg,
      pageBgDark: overwrite.pageBgDark,
    })
  })

  it('mirrors only flat dashboard token fields', () => {
    expect(
      pickDashboardMirrorPatch({
        pageBg: '#ffffff',
        textTitle: '#101010',
        gaussBlurDark: 55,
      }),
    ).toEqual({
      textTitle: '#101010',
      gaussBlurDark: 55,
    })
  })

  it('forks readonly preset edits into custom tokens', () => {
    const { dashboardPatch, nextCustomPresetDraft } = buildCustomPresetEditPatch({
      activePreset: THEME_PRESET.CLAUDE,
      activePresetBase: THEME_PRESET.CLAUDE,
      selectedOverwrite: overwrite,
      customPresetDraft: null,
      patch: { primaryColor: '#999999' },
    })

    expect(dashboardPatch).toMatchObject({
      themePreset: THEME_PRESET.CUSTOM,
      themePresetBase: THEME_PRESET.CLAUDE,
      themeTokens: nextCustomPresetDraft,
    })
    expect(nextCustomPresetDraft.primaryColor).toBe('#999999')
  })

  it('keeps existing custom draft as the edit base', () => {
    const customDraft = { ...overwrite, primaryColor: '#777777' }
    const { nextCustomPresetDraft } = buildCustomPresetEditPatch({
      activePreset: THEME_PRESET.CUSTOM,
      activePresetBase: THEME_PRESET.CLAUDE,
      selectedOverwrite: overwrite,
      customPresetDraft: customDraft,
      patch: { accentColor: '#888888' },
    })

    expect(nextCustomPresetDraft).toMatchObject({
      primaryColor: '#777777',
      accentColor: '#888888',
    })
  })

  it('builds preset selection patches with preserved custom base', () => {
    const { dashboardPatch } = buildPresetSelectionPatch({
      preset: { value: THEME_PRESET.DEFAULT, overwrite },
      currentThemePresetBase: THEME_PRESET.CLAUDE,
      hasCustomThemePreset: true,
      customPresetDraft: null,
    })

    expect(dashboardPatch).toMatchObject({
      themePreset: THEME_PRESET.DEFAULT,
      themePresetBase: THEME_PRESET.CLAUDE,
      themeTokens: overwrite,
      textTitle: overwrite.textTitle,
      gaussBlur: overwrite.gaussBlur,
    })
  })

  it('resets custom tokens to the selected preset without leaving custom mode', () => {
    const { dashboardPatch, nextCustomPresetDraft } = buildCustomPresetResetPatch({
      value: THEME_PRESET.SOLARIZED,
      overwrite,
    })

    expect(dashboardPatch).toMatchObject({
      themePreset: THEME_PRESET.CUSTOM,
      themePresetBase: THEME_PRESET.SOLARIZED,
      themeTokens: nextCustomPresetDraft,
    })
  })
})
