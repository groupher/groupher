import { COLOR, PAGE_BG_COLOR_HEX, PAGE_BG_DEFAULT } from '~/const/colors'
import THEME from '~/const/theme'
import { THEME_PRESET_OPTIONS } from '~/const/theme_preset'
import { getPageBgCustomColor } from '~/lib/color'
import type { TColorName, TThemePreset } from '~/spec'

export const THEME_PRESET_FIELD_KEYS = [
  'pageBg',
  'pageBgDark',
  'pageCustomBg',
  'pageCustomBgDark',
  'pageCustomIntensity',
  'pageCustomIntensityDark',
  'primaryColor',
  'primaryCustomColor',
  'primaryCustomColorDark',
  'accentColor',
  'accentCustomColor',
  'accentCustomColorDark',
  'textTitle',
  'textDigest',
  'gaussBlur',
  'gaussBlurDark',
] as const

export type TThemePresetField = (typeof THEME_PRESET_FIELD_KEYS)[number]

export type TResolvedThemePreset = {
  pageBg: string
  pageBgDark: string
  pageCustomBg: number
  pageCustomBgDark: number
  pageCustomIntensity: number
  pageCustomIntensityDark: number
  primaryColor: TColorName
  primaryCustomColor: string
  primaryCustomColorDark: string
  accentColor: TColorName
  accentCustomColor: string
  accentCustomColorDark: string
  textTitle: string
  textDigest: string
  gaussBlur: number
  gaussBlurDark: number
}

export type TThemePresetSource = Partial<TResolvedThemePreset> & {
  themePreset?: TThemePreset | string
  themeTokens?: Record<string, unknown> | null
  themeOverrides?: Record<string, unknown> | null
}

const DEFAULT_PRESET = THEME_PRESET_OPTIONS[0]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const resolveThemePresetOption = (themePreset?: TThemePreset | string) =>
  THEME_PRESET_OPTIONS.find((preset) => preset.value === themePreset) ?? DEFAULT_PRESET

export const pickThemePresetFields = (source: Partial<TResolvedThemePreset>) => {
  const patch = {} as Partial<TResolvedThemePreset>

  for (const key of THEME_PRESET_FIELD_KEYS) {
    if (source[key] !== undefined && source[key] !== null) {
      patch[key] = source[key] as never
    }
  }

  return patch
}

export const normalizeThemeTokenSource = (
  source: Record<string, unknown> | Partial<TResolvedThemePreset> | null | undefined,
): Partial<TResolvedThemePreset> => {
  if (!isRecord(source)) return {}

  return source as Partial<TResolvedThemePreset>
}

export const pickResolvedThemePresetFields = (source: TResolvedThemePreset): TResolvedThemePreset =>
  pickThemePresetFields(source) as TResolvedThemePreset

export const resolveThemePresetPageBgCssVar = (
  theme: typeof THEME.LIGHT | typeof THEME.DARK,
  pageBg: string | undefined,
  hue: number | undefined,
  intensity: number | undefined,
): string => {
  const fallbackBg =
    theme === THEME.LIGHT ? DEFAULT_PRESET.overrides.pageBg : DEFAULT_PRESET.overrides.pageBgDark
  const resolvedBg = pageBg ?? fallbackBg

  if (resolvedBg === COLOR.CUSTOM) {
    return getPageBgCustomColor(
      theme,
      theme === THEME.LIGHT
        ? (hue ?? DEFAULT_PRESET.overrides.pageCustomBg)
        : (hue ?? DEFAULT_PRESET.overrides.pageCustomBgDark),
      theme === THEME.LIGHT
        ? (intensity ?? DEFAULT_PRESET.overrides.pageCustomIntensity)
        : (intensity ?? DEFAULT_PRESET.overrides.pageCustomIntensityDark),
    )
  }

  return PAGE_BG_COLOR_HEX[resolvedBg] ?? PAGE_BG_COLOR_HEX[PAGE_BG_DEFAULT[theme]]
}

/**
 * Resolve the effective theme preset values from backend/dashboard layout data.
 *
 * New data should use backend-resolved `themeTokens` as the logical source of
 * truth. During migration, old flat layout fields are only used when there are
 * no overrides yet, so stale legacy fields cannot keep overriding preset based
 * edits after the new model has taken ownership.
 */
export const resolveThemePreset = (source: TThemePresetSource = {}): TResolvedThemePreset => {
  const selectedPreset = resolveThemePresetOption(source.themePreset)
  const backendTokens = normalizeThemeTokenSource(source.themeTokens)
  const hasBackendTokens = Object.keys(backendTokens).length > 0
  const overwrite = hasBackendTokens ? {} : normalizeThemeTokenSource(source.themeOverrides)
  const hasOverrides = Object.keys(overwrite).length > 0
  const legacySource = normalizeThemeTokenSource(source)
  const legacyPatch = hasOverrides ? {} : pickThemePresetFields(legacySource)
  const legacyAccentFallback =
    !hasBackendTokens && !hasOverrides && source.accentColor === undefined && source.primaryColor
      ? { accentColor: source.primaryColor }
      : {}

  return {
    ...selectedPreset.overrides,
    ...(hasBackendTokens ? backendTokens : legacyPatch),
    ...legacyAccentFallback,
    ...pickThemePresetFields(overwrite as Partial<TResolvedThemePreset>),
  }
}
