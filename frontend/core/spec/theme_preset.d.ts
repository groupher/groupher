import type { THEME_PRESET } from '~/const/theme_preset'

export type TThemePreset = THEME_PRESET

// Resolved theme tokens returned by the backend theme_tokens resolver.
// Theme-aware data follows the `{ meta?, shared?, light, dark }` modeling rule:
// `light` and `dark` hold values that differ by theme, `shared` holds business
// config used by both themes, and `meta` is reserved for document/resource
// metadata. ThemePreset currently has no metadata, so it only carries
// `{ shared, light, dark }`.
export type TThemePresetSharedTokens = {
  glowFixed: boolean
}

export type TThemePresetThemeTokens = {
  pageBg: string
  pageBgHue: number
  pageBgIntensity: number
  primaryColor: string
  accentColor: string
  textTitle: string
  textDigest: string
  cardColor: string
  dividerColor: string
  gaussBlur: number
  glowType: string
  glowOpacity: number
}

export type TResolvedThemePreset = {
  shared: TThemePresetSharedTokens
  light: TThemePresetThemeTokens
  dark: TThemePresetThemeTokens
}

export type TThemePresetOverwrite = {
  shared?: Partial<TThemePresetSharedTokens>
  light?: Partial<TThemePresetThemeTokens>
  dark?: Partial<TThemePresetThemeTokens>
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
