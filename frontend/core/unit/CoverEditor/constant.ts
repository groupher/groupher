import type { TSettingLevel } from './spec'

// default size it's based on ratio 16:9
export const IMAGE_CONTAINER_SIZE = {
  WIDTH: '710px', // 16:9
  HEIGHT: '400px',
}

export const IMAGE_POS = {
  TOP_LEFT: 'top_left',
  TOP_CENTER: 'top_center',
  TOP_RIGHT: 'top_right',
  CENTER_LEFT: 'center_left',
  CENTER: 'center',
  CENTER_RIGHT: 'center_right',
  BOTTOM_LEFT: 'bottom_left',
  BOTTOM_CENTER: 'bottom_center',
  BOTTOM_RIGHT: 'bottom_right',
  NONE: 'none',
} as const

export const SETTING_LEVEL = {
  L1: 'L1',
  L2: 'L2',
  L3: 'L3',
  L4: 'L4',
  L5: 'L5',
} as const

export const IMAGE_SHADOW = {
  L1: 'none',
  L2: 'rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.06) 0px 2px 4px -1px', // @9
  L3: 'rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
  L4: 'rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.04) 0px 10px 10px -5px',
  L5: 'rgba(0, 0, 0, 0.25) 0px 25px 50px -12px',
} as Record<TSettingLevel, string>

export const IMAGE_SIZE_RANGE = {
  MIN: 50,
  MAX: 100,
} as const

export const IMAGE_RATIO = {
  SQUARE: 'square',
  TV: 'tv',
  SCREEN: 'screen',
} as const

export const IMAGE_BORDER_RADIUS = {
  L1: '0',
  L2: '8px',
  L3: '18px',
  L4: '15px',
  L5: '20px',
} as Record<TSettingLevel, string>

export const BORDER_HIGHLIGHT_DEFAULT = {
  ENABLED: false,
  ANGLE: 35,
  LENGTH: 0.28,
} as const

export const BORDER_HIGHLIGHT_LENGTH_RANGE = {
  MIN: 0.08,
  MAX: 0.72,
} as const

export const BORDER_HIGHLIGHT_STROKE_COLOR = 'wheat'

export const IMAGE_RATIO_SIZE = {
  [IMAGE_RATIO.SCREEN]: {
    width: IMAGE_CONTAINER_SIZE.WIDTH,
    height: IMAGE_CONTAINER_SIZE.HEIGHT,
  },

  [IMAGE_RATIO.TV]: {
    width: '4',
    height: '3',
  },

  [IMAGE_RATIO.SQUARE]: {
    width: '1',
    height: '1',
  },
}
