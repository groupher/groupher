export enum THEME_PRESET {
  DEFAULT = 'DEFAULT',
  CLAUDE = 'CLAUDE',
  SOLARIZED = 'SOLARIZED',
  HN = 'HN',
  CUSTOM = 'CUSTOM',
}

export const DEFAULT_THEME_PRESET = THEME_PRESET.DEFAULT

export const PRESET_FIELD = {
  THEME_PRESET: 'themePreset',
  THEME_PRESET_BASE: 'themePresetBase',
  THEME_TOKENS: 'themeTokens',
  THEME_PRESETS: 'themePresets',
  THEME_OVERWRITE: 'themeOverwrite',
  PAGE_BG: 'pageBg',
  PAGE_BG_HUE: 'pageBgHue',
  PAGE_BG_INTENSITY: 'pageBgIntensity',
  PRIMARY_COLOR: 'primaryColor',
  ACCENT_COLOR: 'accentColor',
  TEXT_TITLE: 'textTitle',
  TEXT_DIGEST: 'textDigest',
  CARD_COLOR: 'cardColor',
  DIVIDER_COLOR: 'dividerColor',
  GAUSS_BLUR: 'gaussBlur',
  GLOW_TYPE: 'glowType',
  GLOW_FIXED: 'glowFixed',
  GLOW_OPACITY: 'glowOpacity',
} as const
