import THEME from '~/const/theme'
import { THEME_PRESET, THEME_PRESET_OPTIONS } from '~/const/theme_preset'
import type { TThemePreset } from '~/spec'

export const THEME_PRESET_FIELD_KEYS = [
  'pageBg',
  'pageBgDark',
  'primaryColor',
  'primaryColorDark',
  'accentColor',
  'accentColorDark',
  'textTitle',
  'textTitleDark',
  'textDigest',
  'textDigestDark',
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
  primaryColor: string
  primaryColorDark: string
  accentColor: string
  accentColorDark: string
  textTitle: string
  textTitleDark: string
  textDigest: string
  textDigestDark: string
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
  themePresetBase?: TThemePreset | string
  themeTokens?: Record<string, unknown> | null
}

const DEFAULT_PRESET = THEME_PRESET_OPTIONS[0]
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const resolveThemePresetColor = (value: string | undefined, fallback: string): string => {
  if (value && HEX_COLOR_RE.test(value)) return value
  return fallback
}

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
): string => {
  const fallbackBg =
    theme === THEME.LIGHT ? DEFAULT_PRESET.overwrite.pageBg : DEFAULT_PRESET.overwrite.pageBgDark

  return resolveThemePresetColor(pageBg, fallbackBg)
}

/**
 * Resolve the effective theme preset values from backend/dashboard layout data.
 *
 * Built-in presets are resolved from their own token set. Only CUSTOM applies
 * saved token overwrite; this keeps stale overwrite from changing a selected
 * built-in preset.
 */
export const resolveThemePreset = (source: TThemePresetSource = {}): TResolvedThemePreset => {
  const isCustomPreset = source.themePreset === THEME_PRESET.CUSTOM
  const selectedPreset = resolveThemePresetOption(
    isCustomPreset ? source.themePresetBase : source.themePreset,
  )
  const backendTokens = normalizeThemeTokenSource(source.themeTokens)
  const customTokens = pickThemePresetFields(backendTokens as Partial<TResolvedThemePreset>)

  return {
    ...selectedPreset.overwrite,
    ...(isCustomPreset ? customTokens : {}),
  }
}
