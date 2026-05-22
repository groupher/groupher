import type { TDsbStoreFieldKey } from '~/stores/dashboard/spec'

export const PRESET_FIELD = {
  THEME_PRESET: 'themePreset',
  THEME_PRESET_BASE: 'themePresetBase',
  THEME_TOKENS: 'themeTokens',
  HAS_CUSTOM_THEME_PRESET: 'hasCustomThemePreset',
  PAGE_BG: 'pageBg',
  PAGE_BG_DARK: 'pageBgDark',
  PRIMARY_COLOR: 'primaryColor',
  PRIMARY_COLOR_DARK: 'primaryColorDark',
  ACCENT_COLOR: 'accentColor',
  ACCENT_COLOR_DARK: 'accentColorDark',
  TEXT_TITLE: 'textTitle',
  TEXT_TITLE_DARK: 'textTitleDark',
  TEXT_DIGEST: 'textDigest',
  TEXT_DIGEST_DARK: 'textDigestDark',
  GAUSS_BLUR: 'gaussBlur',
  GAUSS_BLUR_DARK: 'gaussBlurDark',
  GLOW_TYPE: 'glowType',
  GLOW_TYPE_DARK: 'glowTypeDark',
  GLOW_FIXED: 'glowFixed',
  GLOW_OPACITY: 'glowOpacity',
  GLOW_OPACITY_DARK: 'glowOpacityDark',
} as const

export const THEME_PRESET_STORE_FIELDS = [
  PRESET_FIELD.THEME_PRESET,
  PRESET_FIELD.THEME_PRESET_BASE,
  PRESET_FIELD.THEME_TOKENS,
  PRESET_FIELD.HAS_CUSTOM_THEME_PRESET,
  PRESET_FIELD.TEXT_TITLE,
  PRESET_FIELD.TEXT_TITLE_DARK,
  PRESET_FIELD.TEXT_DIGEST,
  PRESET_FIELD.TEXT_DIGEST_DARK,
  PRESET_FIELD.GAUSS_BLUR,
  PRESET_FIELD.GAUSS_BLUR_DARK,
] as const satisfies readonly TDsbStoreFieldKey[]

export const THEME_TOKEN_MIRROR_FIELDS = [
  PRESET_FIELD.TEXT_TITLE,
  PRESET_FIELD.TEXT_TITLE_DARK,
  PRESET_FIELD.TEXT_DIGEST,
  PRESET_FIELD.TEXT_DIGEST_DARK,
  PRESET_FIELD.GAUSS_BLUR,
  PRESET_FIELD.GAUSS_BLUR_DARK,
] as const

export const PREVIEW_CSS_VAR_CLEANUP = {
  '--preview-page-bg': null,
  '--preview-glow-opacity': null,
} as const
