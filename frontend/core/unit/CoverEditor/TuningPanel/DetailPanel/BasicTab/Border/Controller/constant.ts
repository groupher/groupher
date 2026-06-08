export const COLOR_OPTION = {
  WHITE: 'white',
  BLACK: 'black',
  COLOR: 'color',
  RAINBOW: 'rainbow',
} as const

export const RAINBOW_STOPS = [0, 28, 55, 118, 178, 224, 282, 360]

export const CHECKER_LAYERS = [
  'linear-gradient(45deg, rgba(255, 255, 255, 0.65) 25%, transparent 25%)',
  'linear-gradient(-45deg, rgba(255, 255, 255, 0.65) 25%, transparent 25%)',
  'linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.65) 75%)',
  'linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.65) 75%)',
]

export const CHECKER_BASE_LAYER =
  'linear-gradient(rgba(128, 128, 128, 0.24), rgba(128, 128, 128, 0.24))'

export const CHECKER_BACKGROUND = {
  images: [...CHECKER_LAYERS, CHECKER_BASE_LAYER],
  positions: ['0 0', '0 4px', '4px -4px', '-4px 0px', '0 0'],
  repeats: ['repeat', 'repeat', 'repeat', 'repeat', 'no-repeat'],
  sizes: ['8px 8px', '8px 8px', '8px 8px', '8px 8px', '100% 100%'],
}
