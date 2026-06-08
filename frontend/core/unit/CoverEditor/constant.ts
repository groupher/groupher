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

export const COVER_SHADOW_PRESET = {
  NONE: 'none',
  XSMALL: 'xsmall',
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large',
  XLARGE: 'xlarge',
  CUSTOM: 'custom',
} as const

export const COVER_SHADOW_COLOR_MODE = {
  BLACK: 'black',
  WHITE: 'white',
  COLOR: 'color',
  RAINBOW: 'rainbow',
} as const

export const COVER_SHADOW_DEFAULT = {
  PRESET: COVER_SHADOW_PRESET.NONE,
  COLOR_MODE: COVER_SHADOW_COLOR_MODE.BLACK,
  HUE: 228,
  RAINBOW_HUE: 0,
  X: 0,
  Y: 10,
  BLUR: 24,
  SPREAD: 0,
  OPACITY: 0.35,
} as const

export const COVER_SHADOW_RANGE = {
  X: { MIN: -40, MAX: 40 },
  Y: { MIN: -40, MAX: 60 },
  BLUR: { MIN: 0, MAX: 120 },
  SPREAD: { MIN: -30, MAX: 40 },
  OPACITY: { MIN: 0, MAX: 1 },
  HUE: { MIN: 0, MAX: 359 },
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

export const BORDER_HIGHLIGHT_MODE = {
  SOLID: 'solid',
  RAINBOW: 'rainbow',
} as const

export const BORDER_HIGHLIGHT_DEFAULT = {
  ENABLED: false,
  ANGLE: 35,
  LENGTH: 0.28,
  HUE: 39,
  RAINBOW_HUE: 0,
  SATURATION: 77,
  LIGHTNESS: 83,
  OPACITY: 1,
  MODE: BORDER_HIGHLIGHT_MODE.RAINBOW,
} as const

export const BORDER_HIGHLIGHT_LENGTH_RANGE = {
  MIN: 0.08,
  MAX: 0.72,
} as const

export const BORDER_HIGHLIGHT_COLOR = {
  SATURATION: BORDER_HIGHLIGHT_DEFAULT.SATURATION,
  LIGHTNESS: BORDER_HIGHLIGHT_DEFAULT.LIGHTNESS,
  RAINBOW_SATURATION: 96,
  RAINBOW_LIGHTNESS: 66,
} as const

export const MAGNIFIER_RADIUS_DEFAULT = 0.45

export const MAGNIFIER_RENDER_SIZE = {
  MIN: 104,
  MAX: 250,
} as const

export const MAGNIFIER_ZOOM_DEFAULT = 2

export const MAGNIFIER_ZOOM_RANGE = {
  MIN: 1.2,
  MAX: 3,
} as const
