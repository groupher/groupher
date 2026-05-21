import { COLOR, PAGE_BG_COLOR_HEX, PAGE_BG_DEFAULT } from '~/const/colors'
import THEME from '~/const/theme'
import { THEME_PRESET, THEME_PRESET_OPTIONS } from '~/const/theme_preset'
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
  'glowType',
  'glowTypeDark',
  'glowFixed',
  'glowOpacity',
  'glowOpacityDark',
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
  glowType: string
  glowTypeDark: string
  glowFixed: boolean
  glowOpacity: number
  glowOpacityDark: number
}

export type TThemePresetSource = Partial<TResolvedThemePreset> & {
  themePreset?: TThemePreset | string
  themeTokens?: Record<string, unknown> | null
  themeOverwrite?: Record<string, unknown> | null
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
    theme === THEME.LIGHT ? DEFAULT_PRESET.overwrite.pageBg : DEFAULT_PRESET.overwrite.pageBgDark
  const resolvedBg = pageBg ?? fallbackBg

  if (resolvedBg === COLOR.CUSTOM) {
    return getPageBgCustomColor(
      theme,
      theme === THEME.LIGHT
        ? (hue ?? DEFAULT_PRESET.overwrite.pageCustomBg)
        : (hue ?? DEFAULT_PRESET.overwrite.pageCustomBgDark),
      theme === THEME.LIGHT
        ? (intensity ?? DEFAULT_PRESET.overwrite.pageCustomIntensity)
        : (intensity ?? DEFAULT_PRESET.overwrite.pageCustomIntensityDark),
    )
  }

  return PAGE_BG_COLOR_HEX[resolvedBg] ?? PAGE_BG_COLOR_HEX[PAGE_BG_DEFAULT[theme]]
}

/**
 * Resolve the effective theme preset values from backend/dashboard layout data.
 *
 * Built-in presets are resolved from their own token set. Only CUSTOM applies
 * saved token overwrite; this keeps stale overwrite from changing a selected
 * built-in preset.
 */
export const resolveThemePreset = (source: TThemePresetSource = {}): TResolvedThemePreset => {
  const selectedPreset = resolveThemePresetOption(source.themePreset)
  const isCustomPreset = source.themePreset === THEME_PRESET.CUSTOM
  const backendTokens = normalizeThemeTokenSource(source.themeTokens)
  const overwrite = normalizeThemeTokenSource(source.themeOverwrite)
  const customTokens =
    Object.keys(backendTokens).length > 0
      ? backendTokens
      : pickThemePresetFields(overwrite as Partial<TResolvedThemePreset>)

  return {
    ...selectedPreset.overwrite,
    ...(isCustomPreset ? customTokens : {}),
  }
}
