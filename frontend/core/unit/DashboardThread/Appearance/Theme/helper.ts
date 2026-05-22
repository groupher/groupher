import { THEME_PRESET } from '~/const/theme_preset'
import { blurRGB } from '~/fmt'
import type { TDsbFieldMap } from '~/stores/dashboard/spec'
import { resolveRawBg, type TPageBgDraft } from '~/widgets/CustomPageBg/hooks'

import { PRESET_FIELD, THEME_TOKEN_MIRROR_FIELDS } from './constant'
import type {
  TCustomPresetEditOptions,
  TPageBgPreviewOptions,
  TPreviewCssVars,
  TPresetSelectionOptions,
  TThemePresetOption,
  TThemePresetOverwrite,
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

/**
 * Pick theme-token fields that also live as flat dashboard fields.
 *
 * Intent: `themeTokens` owns the preset payload, but legacy/layout CSS still
 * reads title/digest/blur values from flat dashboard fields. This helper keeps
 * that mirror list in `constant.ts` and avoids repeating field names in callers.
 *
 * Example:
 *   pickDashboardMirrorPatch({ textTitle: '#111111', pageBg: '#ffffff' })
 *   // => { textTitle: '#111111' }
 */
export const pickDashboardMirrorPatch = (
  patch: Partial<TThemePresetOverwrite>,
): Partial<TDsbFieldMap> => {
  const mirrorPatch = {} as Partial<TDsbFieldMap>

  for (const field of THEME_TOKEN_MIRROR_FIELDS) {
    if (patch[field] !== undefined) {
      mirrorPatch[field] = patch[field] as never
    }
  }

  return mirrorPatch
}

/**
 * Convert resolved preset tokens into the compact page-background draft shape.
 *
 * Intent: `CustomPageBg` edits only light/dark background tokens. Keeping this
 * adapter here prevents the UI hook from knowing how that widget names its
 * draft fields.
 *
 * Example:
 *   toPageBgDraft(overwrite)
 *   // => { pageBg: overwrite.pageBg, pageBgDark: overwrite.pageBgDark }
 */
export const toPageBgDraft = (overwrite: TThemePresetOverwrite): TPageBgDraft => ({
  pageBg: overwrite.pageBg,
  pageBgDark: overwrite.pageBgDark,
})

/**
 * Build the dashboard patch for editing preset details as a Custom preset.
 *
 * Intent: any token-level edit should fork the current readonly preset into
 * Custom, while edits on an existing Custom preset keep its original base. The
 * returned draft is also the in-memory Custom draft used when users temporarily
 * switch away from Custom and back before saving.
 *
 * Example:
 *   buildCustomPresetEditPatch({
 *     activePreset: THEME_PRESET.CLAUDE,
 *     activePresetBase: THEME_PRESET.CLAUDE,
 *     selectedOverwrite,
 *     customPresetDraft: null,
 *     patch: { primaryColor: '#222222' },
 *   }).dashboardPatch.themePreset // THEME_PRESET.CUSTOM
 */
export const buildCustomPresetEditPatch = ({
  activePreset,
  activePresetBase,
  selectedOverwrite,
  customPresetDraft,
  patch = {},
}: TCustomPresetEditOptions): {
  dashboardPatch: Partial<TDsbFieldMap>
  nextCustomPresetDraft: TThemePresetOverwrite
} => {
  const themePresetBase = activePreset === THEME_PRESET.CUSTOM ? activePresetBase : activePreset
  const baseOverwrite =
    activePreset === THEME_PRESET.CUSTOM
      ? (customPresetDraft ?? selectedOverwrite)
      : selectedOverwrite
  const nextTokens = {
    ...baseOverwrite,
    ...patch,
  }

  return {
    dashboardPatch: {
      themePreset: THEME_PRESET.CUSTOM,
      themePresetBase,
      themeTokens: nextTokens,
      ...pickDashboardMirrorPatch(nextTokens),
    },
    nextCustomPresetDraft: nextTokens,
  }
}

/**
 * Build the dashboard patch for choosing a preset card.
 *
 * Intent: preset selection updates the active preset and resolved tokens in one
 * batch, while preserving an existing Custom base after the user has already
 * created a Custom preset.
 *
 * Example:
 *   buildPresetSelectionPatch({
 *     preset: defaultPreset,
 *     currentThemePresetBase: THEME_PRESET.CLAUDE,
 *     hasCustomThemePreset: true,
 *     customPresetDraft: null,
 *   }).dashboardPatch.themePreset // defaultPreset.value
 */
export const buildPresetSelectionPatch = ({
  preset,
  currentThemePresetBase,
  hasCustomThemePreset,
  customPresetDraft,
}: TPresetSelectionOptions): {
  dashboardPatch: Partial<TDsbFieldMap>
  nextOverwrite: TThemePresetOverwrite
} => {
  const isCustomPreset = preset.value === THEME_PRESET.CUSTOM
  const nextOverwrite = isCustomPreset ? (customPresetDraft ?? preset.overwrite) : preset.overwrite

  return {
    dashboardPatch: {
      themePreset: preset.value,
      themePresetBase:
        isCustomPreset || hasCustomThemePreset ? currentThemePresetBase : preset.value,
      themeTokens: { ...nextOverwrite },
      ...pickDashboardMirrorPatch(nextOverwrite),
    },
    nextOverwrite,
  }
}

/**
 * Build the dashboard patch for resetting Custom tokens to a readonly preset.
 *
 * Intent: reset keeps the active preset as Custom, but swaps its base and token
 * payload to the chosen readonly preset. The caller can also store the returned
 * draft so later card switching keeps the unsaved reset result alive.
 *
 * Example:
 *   buildCustomPresetResetPatch(claudePreset).dashboardPatch.themePresetBase
 *   // => claudePreset.value
 */
export const buildCustomPresetResetPatch = (
  preset: TThemePresetOption,
): {
  dashboardPatch: Partial<TDsbFieldMap>
  nextCustomPresetDraft: TThemePresetOverwrite
} => {
  const nextOverwrite = { ...preset.overwrite }

  return {
    dashboardPatch: {
      themePreset: THEME_PRESET.CUSTOM,
      themePresetBase: preset.value,
      themeTokens: nextOverwrite,
      ...pickDashboardMirrorPatch(nextOverwrite),
    },
    nextCustomPresetDraft: nextOverwrite,
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
 *     selectedOverwrite,
 *     selectedPageBgDraft,
 *     patch: { pageBg: '#ffffff' },
 *     isLightTheme: true,
 *   }) // => { '--preview-page-bg': 'rgb(...)' }
 */
export const buildPageBgPreviewCssVars = ({
  selectedOverwrite,
  selectedPageBgDraft,
  patch,
  isLightTheme,
}: TPageBgPreviewOptions): TPreviewCssVars => {
  const previewRawBg = resolveRawBg({ ...selectedPageBgDraft, ...patch }, isLightTheme)
  const activeGaussBlur = isLightTheme
    ? selectedOverwrite.gaussBlur
    : selectedOverwrite.gaussBlurDark
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
 *     selectedOverwrite,
 *     patch: { glowOpacity: 80 },
 *     isLightTheme: true,
 *   }) // => { '--preview-page-bg': ..., '--preview-glow-opacity': 0.8 }
 */
export const buildThemePresetPreviewCssVars = ({
  selectedOverwrite,
  patch,
  isLightTheme,
}: TThemePresetPreviewOptions): TPreviewCssVars => {
  const nextOverwrite = {
    ...selectedOverwrite,
    ...patch,
  }
  const previewRawBg = resolveRawBg(toPageBgDraft(nextOverwrite), isLightTheme)
  const activeGaussBlur = isLightTheme ? nextOverwrite.gaussBlur : nextOverwrite.gaussBlurDark
  const previewBackground = previewRawBg ? blurRGB(previewRawBg, activeGaussBlur) : null
  const glowOpacityField = (
    isLightTheme ? PRESET_FIELD.GLOW_OPACITY : PRESET_FIELD.GLOW_OPACITY_DARK
  ) as 'glowOpacity' | 'glowOpacityDark'
  const previewVars: TPreviewCssVars = {
    '--preview-page-bg': previewBackground,
  }

  if (patch[glowOpacityField] !== undefined) {
    previewVars['--preview-glow-opacity'] = toCssOpacity(nextOverwrite[glowOpacityField])
  }

  return previewVars
}
