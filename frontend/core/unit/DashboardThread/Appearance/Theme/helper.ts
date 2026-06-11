import THEME from '~/const/theme'
import { THEME_PRESET } from '~/const/theme_preset'
import { blurRGB } from '~/fmt'
import { getThemePresetSection } from '~/lib/themePreset'
import type { TDsbFieldMap } from '~/stores/dashboard/spec'

import { resolveRawBg, type TPageBgDraft } from './DetailsPanel/CustomPageBg/hooks'
import type {
  TCustomPresetEditOptions,
  TPageBgPreviewOptions,
  TPreviewCssVars,
  TPresetSelectionOptions,
  TThemePresetOverwrite,
  TThemePresetTokens,
  TThemePresetOption,
  TThemePresetPreviewOptions,
} from './spec'

/**
 * Normalize a dashboard opacity percentage into the CSS opacity scale.
 *
 * Intent: dashboard sliders store 0-100, while CSS variables expect 0-1. Keep
 * the clamp here so preview rendering and future persistence code do not
 * duplicate boundary handling.
 *
 * Example:
 *   toCssOpacity(75) // 0.75
 *   toCssOpacity(200) // 1
 */
export const toCssOpacity = (opacity = 100): number => {
  const percent = Number(opacity)

  if (Number.isNaN(percent)) return 1

  return Math.min(Math.max(percent, 0), 100) / 100
}

const getThemeSection = (isLightTheme: boolean): 'light' | 'dark' =>
  isLightTheme ? 'light' : 'dark'

export const buildThemeOverwrite = (
  isLightTheme: boolean,
  patch: Partial<TPageBgDraft>,
): TThemePresetOverwrite => ({
  [getThemeSection(isLightTheme)]: patch,
})

export const mergeThemePresetOverwrite = (
  tokens: TThemePresetTokens,
  overwrite: TThemePresetOverwrite = {},
): TThemePresetTokens => ({
  shared: {
    ...tokens.shared,
    ...overwrite.shared,
  },
  light: {
    ...tokens.light,
    ...overwrite.light,
  },
  dark: {
    ...tokens.dark,
    ...overwrite.dark,
  },
})

export const mergeThemePresetOverwritePatch = (
  current: TThemePresetOverwrite = {},
  overwrite: TThemePresetOverwrite = {},
): TThemePresetOverwrite => ({
  ...(current.shared || overwrite.shared
    ? {
        shared: {
          ...current.shared,
          ...overwrite.shared,
        },
      }
    : {}),
  ...(current.light || overwrite.light
    ? {
        light: {
          ...current.light,
          ...overwrite.light,
        },
      }
    : {}),
  ...(current.dark || overwrite.dark
    ? {
        dark: {
          ...current.dark,
          ...overwrite.dark,
        },
      }
    : {}),
})

/**
 * Convert resolved preset tokens into the compact page-background draft shape.
 *
 * Intent: `CustomPageBg` edits only light/dark background tokens. Keeping this
 * adapter here prevents the UI hook from knowing how that widget names its
 * draft fields.
 *
 * Example:
 *   toPageBgDraft(tokens, true)
 *   // => { pageBg: tokens.light.pageBg, ... }
 */
export const toPageBgDraft = (tokens: TThemePresetTokens, isLightTheme: boolean): TPageBgDraft => ({
  pageBg: getThemePresetSection(tokens, isLightTheme ? THEME.LIGHT : THEME.DARK).pageBg,
  pageBgHue: getThemePresetSection(tokens, isLightTheme ? THEME.LIGHT : THEME.DARK).pageBgHue,
  pageBgIntensity: getThemePresetSection(tokens, isLightTheme ? THEME.LIGHT : THEME.DARK)
    .pageBgIntensity,
})

/**
 * Build the dashboard fields for editing preset details as a Custom preset.
 *
 * Problem scenario: a UI edit needs both full `themeTokens` for immediate
 * rendering and sparse `themeOverwrite` for saving. Writing full tokens to the
 * save payload would erase the DB distinction between base preset and custom
 * overwrite.
 *
 * Intent: any token-level edit should fork the current readonly preset into
 * Custom, while edits on an existing Custom preset keep its original base.
 * `themeTokens` stays as the full render state; `themeOverwrite` stores only
 * the sparse overwrite that should be submitted to the backend for Custom.
 * Readonly preset selection does not persist overwrite fields.
 *
 * Example:
 *   buildCustomPresetEditOverwrite({
 *     activePreset: THEME_PRESET.CLAUDE,
 *     activePresetBase: THEME_PRESET.CLAUDE,
 *     selectedTokens,
 *     customTokensDraft: null,
 *     currentThemeOverwrite: {},
 *     overwrite: { light: { primaryColor: '#222222' } },
 *   }).dashboardFields.themeOverwrite // { light: { primaryColor: '#222222' } }
 */
export const buildCustomPresetEditOverwrite = ({
  activePreset,
  activePresetBase,
  selectedTokens,
  customTokensDraft,
  currentThemeOverwrite,
  overwrite = {},
}: TCustomPresetEditOptions): {
  dashboardFields: Partial<TDsbFieldMap>
  nextCustomTokensDraft: TThemePresetTokens
} => {
  const themePresetBase =
    activePreset === THEME_PRESET.CUSTOM ? (activePresetBase ?? THEME_PRESET.DEFAULT) : activePreset
  const baseTokens =
    activePreset === THEME_PRESET.CUSTOM ? (customTokensDraft ?? selectedTokens) : selectedTokens
  const nextTokens = mergeThemePresetOverwrite(baseTokens, overwrite)
  const nextOverwrite =
    activePreset === THEME_PRESET.CUSTOM
      ? mergeThemePresetOverwritePatch(currentThemeOverwrite, overwrite)
      : overwrite

  return {
    dashboardFields: {
      themePreset: THEME_PRESET.CUSTOM,
      themePresetBase,
      themeTokens: nextTokens,
      themeOverwrite: nextOverwrite,
    },
    nextCustomTokensDraft: nextTokens,
  }
}

/**
 * Build the dashboard fields for choosing a preset card.
 *
 * Problem scenario: preset selection changes the render tokens immediately,
 * but should not turn readonly preset tokens into a Custom overwrite payload.
 *
 * Intent: preset selection updates the active preset and resolved tokens in one
 * batch, while preserving an existing Custom base after the user has already
 * created a Custom preset.
 *
 * Example:
 *   buildPresetSelectionFields({
 *     preset: defaultPreset,
 *     currentThemePresetBase: THEME_PRESET.CLAUDE,
 *     customTokensDraft: null,
 *   }).dashboardFields.themePreset // defaultPreset.value
 */
export const buildPresetSelectionFields = ({
  preset,
  currentThemePresetBase,
  customTokensDraft,
}: TPresetSelectionOptions): {
  dashboardFields: Partial<TDsbFieldMap>
  nextTokens: TThemePresetTokens
} => {
  const isCustomPreset = preset.value === THEME_PRESET.CUSTOM
  const nextTokens = isCustomPreset ? (customTokensDraft ?? preset.tokens) : preset.tokens

  return {
    dashboardFields: {
      themePreset: preset.value,
      themePresetBase: currentThemePresetBase ?? THEME_PRESET.DEFAULT,
      themeTokens: { ...nextTokens },
    },
    nextTokens,
  }
}

/**
 * Build the dashboard fields for resetting Custom tokens to a readonly preset.
 *
 * Problem scenario: reset is replace semantics, not merge semantics. The
 * Custom preset should point at the selected base and clear sparse overwrite.
 *
 * Intent: reset keeps the active preset as Custom, but swaps its base and token
 * payload to the chosen readonly preset. The caller can also store the returned
 * draft so later card switching keeps the unsaved reset result alive.
 *
 * Example:
 *   buildCustomPresetResetOverwrite(claudePreset).dashboardFields.themePresetBase
 *   // => claudePreset.value
 */
export const buildCustomPresetResetOverwrite = (
  preset: TThemePresetOption,
): {
  dashboardFields: Partial<TDsbFieldMap>
  nextCustomTokensDraft: TThemePresetTokens
} => {
  const nextTokens = { ...preset.tokens }

  return {
    dashboardFields: {
      themePreset: THEME_PRESET.CUSTOM,
      themePresetBase: preset.value,
      themeTokens: nextTokens,
      themeOverwrite: {},
    },
    nextCustomTokensDraft: nextTokens,
  }
}

/**
 * Build preview CSS vars for page background edits.
 *
 * Intent: background pickers need immediate DOM feedback without touching the
 * dashboard store. This helper computes the same blurred background value the
 * page will use after the debounced commit lands.
 *
 * Keep this as a CSS-var payload only. The var is rendered by GlobalLayout's
 * isolated background layer so tint/glass sliders do not repaint <main>.
 *
 * Example:
 *   buildPageBgPreviewCssVars({
 *     selectedTokens,
 *     selectedPageBgDraft,
 *     patch: { pageBg: '#ffffff' },
 *     isLightTheme: true,
 *   }) // => { '--preview-page-bg': 'rgb(...)' }
 */
export const buildPageBgPreviewCssVars = ({
  selectedTokens,
  selectedPageBgDraft,
  patch,
  isLightTheme,
}: TPageBgPreviewOptions): TPreviewCssVars => {
  const previewRawBg = resolveRawBg({ ...selectedPageBgDraft, ...patch }, isLightTheme)
  const activeGaussBlur = getThemePresetSection(
    selectedTokens,
    isLightTheme ? THEME.LIGHT : THEME.DARK,
  ).gaussBlur
  const previewBackground = previewRawBg ? blurRGB(previewRawBg, activeGaussBlur) : null

  return { '--preview-page-bg': previewBackground }
}

/**
 * Build preview CSS vars for full theme-token edits.
 *
 * Intent: detail controls can change multiple preset tokens. This helper keeps
 * preview-only CSS concerns together, including the special glow opacity var
 * that must be converted from dashboard percent to CSS opacity.
 *
 * Glass opacity can produce transparent color-mix values; those only look right
 * because <main> itself is transparent and the background layer owns the color.
 *
 * Example:
 *   buildThemePresetPreviewCssVars({
 *     selectedTokens,
 *     overwrite: { light: { glowOpacity: 80 } },
 *     isLightTheme: true,
 *   }) // => { '--preview-page-bg': ..., '--preview-glow-opacity': 0.8 }
 */
export const buildThemePresetPreviewCssVars = ({
  selectedTokens,
  overwrite,
  isLightTheme,
}: TThemePresetPreviewOptions): TPreviewCssVars => {
  const nextTokens = mergeThemePresetOverwrite(selectedTokens, overwrite)
  const section = getThemeSection(isLightTheme)
  const activeTokens = nextTokens[section]
  const previewRawBg = resolveRawBg(toPageBgDraft(nextTokens, isLightTheme), isLightTheme)
  const activeGaussBlur = activeTokens.gaussBlur
  const previewBackground = previewRawBg ? blurRGB(previewRawBg, activeGaussBlur) : null
  const previewVars: TPreviewCssVars = {
    '--preview-page-bg': previewBackground,
  }

  if (overwrite[section]?.glowOpacity !== undefined) {
    previewVars['--preview-glow-opacity'] = toCssOpacity(activeTokens.glowOpacity)
  }

  return previewVars
}
