export const THEME_PRESET = {
  DEFAULT: 'DEFAULT',
  CLAUDE: 'CLAUDE',
  SOLARIZED: 'SOLARIZED',
  HN: 'HN',
  CUSTOM: 'CUSTOM',
} as const

export const DEFAULT_THEME_PRESET = THEME_PRESET.DEFAULT

export const PRESET_FIELD = {
  THEME_PRESET: 'themePreset',
  THEME_PRESET_BASE: 'themePresetBase',
  THEME_TOKENS: 'themeTokens',
  HAS_CUSTOM_THEME_PRESET: 'hasCustomThemePreset',
  PAGE_BG: 'pageBg',
  PAGE_BG_DARK: 'pageBgDark',
  PAGE_BG_HUE: 'pageBgHue',
  PAGE_BG_HUE_DARK: 'pageBgHueDark',
  PAGE_BG_INTENSITY: 'pageBgIntensity',
  PAGE_BG_INTENSITY_DARK: 'pageBgIntensityDark',
  PRIMARY_COLOR: 'primaryColor',
  PRIMARY_COLOR_DARK: 'primaryColorDark',
  ACCENT_COLOR: 'accentColor',
  ACCENT_COLOR_DARK: 'accentColorDark',
  TEXT_TITLE: 'textTitle',
  TEXT_TITLE_DARK: 'textTitleDark',
  TEXT_DIGEST: 'textDigest',
  TEXT_DIGEST_DARK: 'textDigestDark',
  CARD_COLOR: 'cardColor',
  CARD_COLOR_DARK: 'cardColorDark',
  DIVIDER_COLOR: 'dividerColor',
  DIVIDER_COLOR_DARK: 'dividerColorDark',
  GAUSS_BLUR: 'gaussBlur',
  GAUSS_BLUR_DARK: 'gaussBlurDark',
  GLOW_TYPE: 'glowType',
  GLOW_TYPE_DARK: 'glowTypeDark',
  GLOW_FIXED: 'glowFixed',
  GLOW_OPACITY: 'glowOpacity',
  GLOW_OPACITY_DARK: 'glowOpacityDark',
} as const

export const DEFAULT_TEXT_TITLE = '#243041'
export const DEFAULT_TEXT_DIGEST = '#6b7280'
export const DEFAULT_TEXT_TITLE_DARK = '#f5f5f5'
export const DEFAULT_TEXT_DIGEST_DARK = '#949494'
export const DEFAULT_CARD_COLOR = '#ffffff'
export const DEFAULT_CARD_COLOR_DARK = '#252525'
export const DEFAULT_DIVIDER_COLOR = '#eae9e9'
export const DEFAULT_DIVIDER_COLOR_DARK = '#353535'

export const DEFAULT_THEME_PRESET_TOKENS = {
  pageBg: '#fffcfc',
  pageBgDark: '#25161d',
  pageBgHue: 0,
  pageBgHueDark: 332,
  pageBgIntensity: 0,
  pageBgIntensityDark: 6,
  primaryColor: '#7d519e',
  primaryColorDark: '#9669b9',
  accentColor: '#5073c6',
  accentColorDark: '#3a7ec7',
  textTitle: DEFAULT_TEXT_TITLE,
  textTitleDark: DEFAULT_TEXT_TITLE_DARK,
  textDigest: DEFAULT_TEXT_DIGEST,
  textDigestDark: DEFAULT_TEXT_DIGEST_DARK,
  cardColor: DEFAULT_CARD_COLOR,
  cardColorDark: DEFAULT_CARD_COLOR_DARK,
  dividerColor: DEFAULT_DIVIDER_COLOR,
  dividerColorDark: DEFAULT_DIVIDER_COLOR_DARK,
  gaussBlur: 100,
  gaussBlurDark: 100,
  glowType: '',
  glowTypeDark: '',
  glowFixed: true,
  glowOpacity: 100,
  glowOpacityDark: 100,
} as const
