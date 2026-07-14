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

export const RAINBOW_SOFT_COLOR_HEX = {
  [THEME.LIGHT]: {
    [COLOR.BLACK]: '#f4f4f4',
    [COLOR.PINK]: '#ffd8ea59',
    [COLOR.RED]: '#ffebec',
    [COLOR.ORANGE]: '#fef7e8',
    [COLOR.YELLOW]: '#fefbe8',
    [COLOR.BROWN]: '#fff3df',
    [COLOR.GREEN_LIGHT]: '#e3f3cc4a',
    [COLOR.GREEN]: '#eefdd89c',
    [COLOR.CYAN]: '#e1fcff',
    [COLOR.CYAN_LIGHT]: '#e1fcff94',
    [COLOR.BLUE]: '#e7edf7',
    [COLOR.PURPLE]: '#f7d8fd38',
  },
  [THEME.DARK]: {
    [COLOR.BLACK]: '#313131',
    [COLOR.PINK]: '#73526159',
    [COLOR.RED]: '#7d3b363d',
    [COLOR.ORANGE]: '#3f332dba',
    [COLOR.YELLOW]: '#a9a06a30',
    [COLOR.BROWN]: '#3a342b',
    [COLOR.GREEN_LIGHT]: '#69735a4a',
    [COLOR.GREEN]: '#4248374a',
    [COLOR.CYAN]: '#2c3738',
    [COLOR.CYAN_LIGHT]: '#39494b94',
    [COLOR.BLUE]: '#27324c54',
    [COLOR.PURPLE]: '#76478147',
  },
} as const
