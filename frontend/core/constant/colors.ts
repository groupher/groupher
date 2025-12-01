import type { TColorName } from '~/spec'

export const CONTAINER_BG_DEFAULT = {
  light: 'PURE_WHITE',
  dark: 'OUTER_SPACE',
}

export const COLOR_NAME = {
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
} as Record<TColorName, TColorName>

// map to css var name in ~/tailwind/token/colors
export const PAGE_BG_CSS_KEY = 'color-pageBg'
