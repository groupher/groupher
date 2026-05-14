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

export const PAGE_BG_DEFAULT = {
  [THEME.LIGHT]: 'pure white',
  [THEME.DARK]: 'outer space',
}

export const PAGE_COLORS = {
  [THEME.LIGHT]: [
    'pure white',
    'solarized',
    'hacker news',
    'light grey',
    'floral white',
    'mint white',
    'pink',
    'todo2',
    'blue2',
    'purple',
    'todo',
  ],
  [THEME.DARK]: [
    'charcoal gray',
    'dark slate gray',
    'outer space',
    'rich black',
    'coffee bean',
    'ubuntu',
    'obsidian',
    'solarized dark',
    'black chocolate',
    'gunmetal',
    'smoky black',
    'oxford blue',
    'eerie black',
    'daylight green',
    'jet black',
    'arsenic',
  ],
}

export const PAGE_BG_COLOR_HEX = {
  'pure white': '#fff',
  solarized: '#fef6e4',
  'hacker news': '#f6f6f0',
  'light grey': '#fafaf9',
  'floral white': '#fffaf0',
  'mint white': '#f5fefa',
  pink: '#fff8fd',
  todo2: '#fdf2e8',
  blue2: '#f0f6fb',
  purple: '#f5f2fe',
  todo: '#fef8f7',
  'charcoal gray': '#121212',
  'dark slate gray': '#191919',
  'outer space': '#212121',
  'rich black': '#0a0a0a',
  'coffee bean': '#1b1b1b',
  ubuntu: '#240e1d',
  obsidian: '#0b1215',
  'solarized dark': '#002b35',
  'black chocolate': '#100d08',
  gunmetal: '#1d1f21',
  'smoky black': '#101720',
  'oxford blue': '#212a37',
  'eerie black': '#232023',
  'daylight green': '#1c1d12',
  'jet black': '#161618',
  arsenic: '#11181c',
} as const
