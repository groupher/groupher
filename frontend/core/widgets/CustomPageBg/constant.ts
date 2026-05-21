import THEME from '~/const/theme'

const PAGE_BG_THEME_KEYS = {
  [THEME.LIGHT]: 'light',
  [THEME.DARK]: 'dark',
} as const

export const PAGE_BG_THEME_FIELDS = {
  [THEME.LIGHT]: {
    pageBg: 'pageBg',
    presetKey: PAGE_BG_THEME_KEYS[THEME.LIGHT],
  },
  [THEME.DARK]: {
    pageBg: 'pageBgDark',
    presetKey: PAGE_BG_THEME_KEYS[THEME.DARK],
  },
} as const
