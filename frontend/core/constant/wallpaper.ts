import type { TWallpaper } from '~/spec'

export { PATTERN_WALLPAPER } from './wallpaper.generated'

export const WALLPAPER_STATE_KEYS = [
  'customWallpaper',
  'customColorValue',
  'source',
  'type',
  'hasPattern',
  'blurIntensity',
  'hasShadow',
  'brightness',
  'saturation',
  'direction',
  'bgSize',
] as const

export const WALLPAPER_SAVABLE_STATE_KEYS = [
  'customColorValue',
  'source',
  'type',
  'hasPattern',
  'blurIntensity',
  'hasShadow',
  'brightness',
  'saturation',
  'direction',
  'bgSize',
] as const

export const WALLPAPER_TYPE = {
  PATTERN: 'pattern',
  GRADIENT: 'gradient',
  CUSTOM_GRADIENT: 'custom_gradient',
  UPLOAD: 'upload',
  NONE: 'none',
} as const

// demo: `
//     background: url(/wallpaper/pattern/1.png) repeat, linear-gradient(to bottom, #C6D183, #72B58C);
//   `,

const DEFAULT_GRADIENT_EFFECT = {
  hasPattern: false,
  blurIntensity: 0,
  direction: '180deg',
}

export const COVER_GRADIENT_WALLPAPER = {
  // linear gradient
  // background: #2c3e50; /* fallback for old browsers */
  // background: -webkit-linear-gradient(#C6D183, #72B58C); /* Chrome 10-25, Safari 5.1-6 */
  grey: {
    colors: ['#eef2f3', '#8e9eab'],
    ...DEFAULT_GRADIENT_EFFECT,
    hasPattern: true,
  },
  grey2: {
    colors: ['#fff', '#abbaab'],
    ...DEFAULT_GRADIENT_EFFECT,
    hasPattern: true,
  },
  grey3: {
    colors: ['#fff', '#DED9D2'],
    ...DEFAULT_GRADIENT_EFFECT,
    hasPattern: true,
  },
  pink: {
    colors: ['#E8DADA', '#D4D0D6'],
    ...DEFAULT_GRADIENT_EFFECT,
    blurIntensity: 60,
  },
  green: {
    colors: ['#C6D183', '#72B58C'],
    ...DEFAULT_GRADIENT_EFFECT,
    hasPattern: true,
  },
  green2: {
    colors: ['#00D8BF', '#3B8DC0'],
    ...DEFAULT_GRADIENT_EFFECT,
    hasPattern: true,
  },
  purple: {
    colors: ['#BBA4C9', '#8390CD'],
    ...DEFAULT_GRADIENT_EFFECT,
  },
  purple2: {
    colors: ['#323455', '#624b77'],
    ...DEFAULT_GRADIENT_EFFECT,
  },
  purple3: {
    // colors: ['#BE5C4C', '#006588'],
    colors: ['#AEB8BE', '#D6A795'],
    ...DEFAULT_GRADIENT_EFFECT,
  },
  yellow: {
    colors: ['#F7CE7E', '#E17D43'],
    ...DEFAULT_GRADIENT_EFFECT,
  },
  kangaroo: {
    colors: ['#7CB29B', '#EECA95', '#F5EED9'],
    ...DEFAULT_GRADIENT_EFFECT,
  },
  blue: {
    colors: ['#85AADA', '#274AA1'],
    ...DEFAULT_GRADIENT_EFFECT,
  },
  red: {
    colors: ['#FFA69E', '#861657'],
    ...DEFAULT_GRADIENT_EFFECT,
  },
  rainbox: {
    colors: ['#FF695C', '#A46AAF', '#5A6DEC'],
    ...DEFAULT_GRADIENT_EFFECT,
  },
  rainbox2: {
    colors: ['#FF987F', '#B4B8F8'],
    ...DEFAULT_GRADIENT_EFFECT,
  },
} satisfies Record<string, TWallpaper>

export const GRADIENT_WALLPAPER_NAME = {
  PINK: 'pink',
  GREEN: 'green',
  ORANGE: 'orange',
  PURPLE: 'purple',
  GREY: 'grey',
  BLUE: 'blue',
}

export const GRADIENT_WALLPAPER = {
  // linear gradian
  // background: #2c3e50; /* fallback for old browsers */
  // background: -webkit-linear-gradient(#C6D183, #72B58C); /* Chrome 10-25, Safari 5.1-6 */
  [GRADIENT_WALLPAPER_NAME.PINK]: {
    colors: ['#FBEFDE', '#D8B9E3'],
    ...DEFAULT_GRADIENT_EFFECT,
    blurIntensity: 60,
  },

  [GRADIENT_WALLPAPER_NAME.GREEN]: {
    colors: ['#D6D9B8', '#87BB89'],
    ...DEFAULT_GRADIENT_EFFECT,
    hasPattern: true,
  },

  [GRADIENT_WALLPAPER_NAME.ORANGE]: {
    colors: ['#ffefc4', '#c06577'],
    ...DEFAULT_GRADIENT_EFFECT,
    hasPattern: true,
  },
  [GRADIENT_WALLPAPER_NAME.PURPLE]: {
    colors: ['#69999F', '#6B80A7', '#8C8EBB'],
    ...DEFAULT_GRADIENT_EFFECT,
  },
  [GRADIENT_WALLPAPER_NAME.GREY]: {
    colors: ['#EEEBE8', '#E7E2DD', '#dccfc2'],
    ...DEFAULT_GRADIENT_EFFECT,
  },
  [GRADIENT_WALLPAPER_NAME.BLUE]: {
    colors: ['#daf3fb', '#B8D1FA', '#c7bbf2', '#6390c5'],
    ...DEFAULT_GRADIENT_EFFECT,
  },
} as Record<string, TWallpaper>

export const GRADIENT_DIRECTION = {
  TOP: 'top',
  TOP_RIGHT: 'top right',
  RIGHT: 'right',
  BOTTOM_RIGHT: 'bottom right',
  BOTTOM: 'bottom',
  BOTTOM_LEFT: 'bottom left',
  LEFT: 'left',
  TOP_LEFT: 'top left',
} as const
