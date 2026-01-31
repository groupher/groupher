import THEME from '~/const/theme'

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
