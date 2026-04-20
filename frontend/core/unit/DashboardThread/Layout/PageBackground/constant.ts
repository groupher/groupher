import THEME from '~/const/theme'

export const PAGE_BG_THEME_KEYS = {
  [THEME.LIGHT]: 'light',
  [THEME.DARK]: 'dark',
} as const

export const PAGE_BG_DRAFT_KEYS = [
  'pageBg',
  'pageBgDark',
  'pageCustomBg',
  'pageCustomBgDark',
  'pageCustomIntensity',
  'pageCustomIntensityDark',
] as const

export const COLORED_PAGE_BG = {
  [THEME.LIGHT]: new Set(['mint white', 'pink', 'todo2', 'blue2', 'purple', 'todo']),
  [THEME.DARK]: new Set([
    'ubuntu',
    'obsidian',
    'solarized dark',
    'oxford blue',
    'daylight green',
    'arsenic',
  ]),
} as const

export const SOLARIZED_PAGE_BG = {
  [THEME.LIGHT]: 'solarized',
  [THEME.DARK]: 'solarized dark',
} as const

export const PAGE_BG_THEME_FIELDS = {
  [THEME.LIGHT]: {
    pageBg: 'pageBg',
    pageCustomBg: 'pageCustomBg',
    pageCustomIntensity: 'pageCustomIntensity',
    presetKey: PAGE_BG_THEME_KEYS[THEME.LIGHT],
  },
  [THEME.DARK]: {
    pageBg: 'pageBgDark',
    pageCustomBg: 'pageCustomBgDark',
    pageCustomIntensity: 'pageCustomIntensityDark',
    presetKey: PAGE_BG_THEME_KEYS[THEME.DARK],
  },
} as const
