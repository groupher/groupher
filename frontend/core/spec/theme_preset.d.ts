import type { THEME_PRESET } from '~/const/theme_preset'
import type { TConstValues } from '~/spec'

export type TThemePreset = TConstValues<typeof THEME_PRESET>

// Resolved theme tokens returned by the backend theme_tokens resolver.
// Every light token follows the paired `xx / xxDark` convention when it has a
// dark value.
export type TResolvedThemePreset = {
  pageBg: string
  pageBgDark: string
  pageBgHue: number
  pageBgHueDark: number
  pageBgIntensity: number
  pageBgIntensityDark: number
  primaryColor: string
  primaryColorDark: string
  accentColor: string
  accentColorDark: string
  textTitle: string
  textTitleDark: string
  textDigest: string
  textDigestDark: string
  cardColor: string
  cardColorDark: string
  dividerColor: string
  dividerColorDark: string
  gaussBlur: number
  gaussBlurDark: number
  glowType: string
  glowTypeDark: string
  glowFixed: boolean
  glowOpacity: number
  glowOpacityDark: number
}

export type TThemePresetOption = {
  value: TThemePreset
  tokens: TResolvedThemePreset
}

export type TThemePresetsQuery = {
  themePresets: Array<{
    value: TThemePreset
    tokens: TResolvedThemePreset
  }>
}
