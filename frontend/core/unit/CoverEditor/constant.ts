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

export const IMAGE_SHADOW_RANGE = {
  MIN: 0,
  MAX: 100,
} as const

export const IMAGE_SIZE_RANGE = {
  MIN: 50,
  MAX: 100,
} as const

// Minimum visible area, in the 710x400 cover design canvas, kept inside the viewport.
export const COVER_IMAGE_MIN_VISIBLE_SIZE = 200

export const IMAGE_BORDER_RADIUS_RANGE = {
  MIN: 0,
  MAX: 40,
} as const

export const GLASS_FRAME = {
  PADDING_X: 7.5,
  PADDING_Y: 6.5,
} as const

export const BORDER_HIGHLIGHT_DEFAULT = {
  ENABLED: false,
  ANGLE: 35,
  LENGTH: 0.28,
  HUE: 39,
  OPACITY: 1,
} as const

export const BORDER_HIGHLIGHT_LENGTH_RANGE = {
  MIN: 0.08,
  MAX: 0.72,
} as const

export const BORDER_HIGHLIGHT_COLOR = {
  SATURATION: 77,
  LIGHTNESS: 83,
} as const

export const LIGHT_RADIUS_DEFAULT = 0.5

export const LIGHT_RENDER_SIZE = {
  MIN: 140,
  MAX: 560,
} as const

export const LIGHT_RENDER_OPACITY = {
  MIN: 0.07,
  MAX: 0.2,
} as const
