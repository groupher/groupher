import THEME from '~/const/theme'
import type { TThemeName } from '~/spec'

export const COLOR = {
  BLACK: 'BLACK',
  PINK: 'PINK',
  RED: 'RED',
  ORANGE: 'ORANGE',
  YELLOW: 'YELLOW',
  BROWN: 'BROWN',
  GREEN_LIGHT: 'GREEN_LIGHT',
  GREEN: 'GREEN',
  CYAN: 'CYAN',
  CYAN_LIGHT: 'CYAN_LIGHT',
  BLUE: 'BLUE',
  PURPLE: 'PURPLE',
  CUSTOM: 'CUSTOM',
} as const

const DEFAULT_CUSTOM_COLOR = {
  [THEME.LIGHT]: '#333333',
  [THEME.DARK]: '#ffffff',
} as const

export const getDefaultCustomColor = (theme: TThemeName): string => {
  return DEFAULT_CUSTOM_COLOR[theme]
}

export const STACKED_COLOR = {
  RED: 'RED',
  ORANGE: 'ORANGE',
  GREEN: 'GREEN',
  BLUE: 'BLUE',
  PURPLE: 'PURPLE',
} as const

// map to css var name in ~/tailwind/token/colors
export const PAGE_BG_CSS_KEY = 'color-pageBg'

export const RAINBOW_COLOR_HEX = {
  [THEME.LIGHT]: {
    [COLOR.BLACK]: '#333333',
    [COLOR.PINK]: '#b36976',
    [COLOR.RED]: '#ca5f4d',
    [COLOR.ORANGE]: '#ffa500',
    [COLOR.YELLOW]: '#c7b96d',
    [COLOR.BROWN]: '#8d691e',
    [COLOR.GREEN_LIGHT]: '#79d08f',
    [COLOR.GREEN]: '#699411',
    [COLOR.CYAN]: '#24878c',
    [COLOR.CYAN_LIGHT]: '#00b5cc',
    [COLOR.BLUE]: '#5073c6',
    [COLOR.PURPLE]: '#7d519e',
  },
  [THEME.DARK]: {
    [COLOR.BLACK]: '#333333',
    [COLOR.PINK]: '#b36976',
    [COLOR.RED]: '#ca5f4d',
    [COLOR.ORANGE]: '#ffa500',
    [COLOR.YELLOW]: '#c7b96d',
    [COLOR.BROWN]: '#8d691e',
    [COLOR.GREEN_LIGHT]: '#37b784',
    [COLOR.GREEN]: '#699411',
    [COLOR.CYAN]: '#24878c',
    [COLOR.CYAN_LIGHT]: '#00b5cc',
    [COLOR.BLUE]: '#3a7ec7',
    [COLOR.PURPLE]: '#9669b9',
  },
} as const
