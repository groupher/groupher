import { THEME_PRESET_OPTIONS } from '~/const/theme_preset'
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
  'subPrimaryColor',
  'textTitle',
  'textDigest',
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
  subPrimaryColor: TColorName
  textTitle: string
  textDigest: string
}

export type TThemePresetSource = Partial<TResolvedThemePreset> & {
  themePreset?: TThemePreset | string
  themeOverrides?: Record<string, unknown> | null
}

const DEFAULT_PRESET = THEME_PRESET_OPTIONS[0]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const resolveThemePresetOption = (themePreset?: TThemePreset | string) =>
  THEME_PRESET_OPTIONS.find((preset) => preset.value === themePreset) ?? DEFAULT_PRESET

const pickThemePresetFields = (source: Partial<TResolvedThemePreset>) => {
  const patch = {} as Partial<TResolvedThemePreset>

  for (const key of THEME_PRESET_FIELD_KEYS) {
    if (source[key] !== undefined && source[key] !== null) {
      patch[key] = source[key] as never
    }
  }

  return patch
}

/**
 * Resolve the effective theme preset values from backend/dashboard layout data.
 *
 * New data should use `themePreset + themeOverrides` as the logical source of
 * truth. During migration, old flat layout fields are only used when there are
 * no overrides yet, so stale legacy fields cannot keep overriding preset based
 * edits after the new model has taken ownership.
 */
export const resolveThemePreset = (source: TThemePresetSource = {}): TResolvedThemePreset => {
  const selectedPreset = resolveThemePresetOption(source.themePreset)
  const overrides = isRecord(source.themeOverrides) ? source.themeOverrides : {}
  const hasOverrides = Object.keys(overrides).length > 0
  const legacyPatch = hasOverrides ? {} : pickThemePresetFields(source)
  const legacySubPrimaryFallback =
    !hasOverrides && source.subPrimaryColor === undefined && source.primaryColor
      ? { subPrimaryColor: source.primaryColor }
      : {}

  return {
    ...selectedPreset.overrides,
    ...legacyPatch,
    ...legacySubPrimaryFallback,
    ...pickThemePresetFields(overrides as Partial<TResolvedThemePreset>),
  }
}
