import { GRADIENT_TYPE, MESH_GRADIENT_MODEL, type TGradientRecipe } from '~/lib/wallpaperMesh'
import type { TWallpaper } from '~/spec'

export { PATTERN_WALLPAPER, WALLPAPER_PATTERN } from './wallpaper.generated'

export const DEFAULT_WALLPAPER_PATTERN_ID = '01'

export const WALLPAPER_PATTERN_TONE = {
  DARK: 'dark',
  LIGHT: 'light',
} as const

export const WALLPAPER_STATE_KEYS = [
  'customWallpaper',
  'source',
  'type',
  'hasPattern',
  'patternId',
  'patternIntensity',
  'patternTone',
  'hasTexture',
  'blurIntensity',
  'hasShadow',
  'brightness',
  'saturation',
  'gradient',
  'texture',
  'bgSize',
] as const

export const WALLPAPER_SAVABLE_STATE_KEYS = [
  'source',
  'type',
  'hasPattern',
  'patternId',
  'patternIntensity',
  'patternTone',
  'hasTexture',
  'blurIntensity',
  'hasShadow',
  'brightness',
  'saturation',
  'gradient',
  'texture',
  'bgSize',
] as const

export const WALLPAPER_TYPE = {
  PATTERN: 'picture',
  GRADIENT: 'gradient',
  UPLOAD: 'upload',
  NONE: 'none',
} as const

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
  PASTEL: 'pastel',
  MEADOW: 'meadow',
  AURORA: 'aurora',
  LAGOON: 'lagoon',
  SUNSET: 'sunset',
  OCEAN: 'ocean',
  BLOOM: 'bloom',
  CEDAR: 'cedar',
  DUNE: 'dune',
  MINT: 'mint',
  DEEP_SEA: 'deep_sea',
  TANGERINE: 'tangerine',
  NEXT_GLOW: 'next_glow',
} as const

export const GRADIENT_WALLPAPER = {
  [GRADIENT_WALLPAPER_NAME.PINK]: {
    version: 1,
    kind: GRADIENT_TYPE.LINEAR,
    preset: GRADIENT_WALLPAPER_NAME.PINK,
    colors: ['#FBEFDE', '#D8B9E3'],
    angle: 180,
    spread: 52,
  },
  [GRADIENT_WALLPAPER_NAME.GREEN]: {
    version: 1,
    kind: GRADIENT_TYPE.LINEAR,
    preset: GRADIENT_WALLPAPER_NAME.GREEN,
    colors: ['#D6D9B8', '#87BB89'],
    angle: 180,
    spread: 58,
  },
  [GRADIENT_WALLPAPER_NAME.ORANGE]: {
    version: 1,
    kind: GRADIENT_TYPE.LINEAR,
    preset: GRADIENT_WALLPAPER_NAME.ORANGE,
    colors: ['#ffefc4', '#c06577'],
    angle: 180,
    spread: 48,
  },
  [GRADIENT_WALLPAPER_NAME.PURPLE]: {
    version: 1,
    kind: GRADIENT_TYPE.LINEAR,
    preset: GRADIENT_WALLPAPER_NAME.PURPLE,
    colors: ['#69999F', '#6B80A7', '#8C8EBB'],
    angle: 180,
    spread: 62,
  },
  [GRADIENT_WALLPAPER_NAME.BLUE]: {
    version: 1,
    kind: GRADIENT_TYPE.RADIAL,
    preset: GRADIENT_WALLPAPER_NAME.BLUE,
    colors: ['#daf3fb', '#B8D1FA', '#c7bbf2', '#6390c5'],
    center: { x: 0.52, y: 0.28 },
    radius: 82,
    shape: 'ellipse',
    spread: 58,
  },
  [GRADIENT_WALLPAPER_NAME.CEDAR]: {
    version: 1,
    kind: GRADIENT_TYPE.LINEAR,
    preset: GRADIENT_WALLPAPER_NAME.CEDAR,
    colors: ['#4f6851', '#203a27'],
    angle: 112,
    spread: 74,
  },
  [GRADIENT_WALLPAPER_NAME.DUNE]: {
    version: 1,
    kind: GRADIENT_TYPE.LINEAR,
    preset: GRADIENT_WALLPAPER_NAME.DUNE,
    colors: ['#e6cda7', '#b58a58'],
    angle: 118,
    spread: 72,
  },
  [GRADIENT_WALLPAPER_NAME.MINT]: {
    version: 1,
    kind: GRADIENT_TYPE.LINEAR,
    preset: GRADIENT_WALLPAPER_NAME.MINT,
    colors: ['#5fcf94', '#9a9634'],
    angle: 116,
    spread: 68,
  },
  [GRADIENT_WALLPAPER_NAME.DEEP_SEA]: {
    version: 1,
    kind: GRADIENT_TYPE.LINEAR,
    preset: GRADIENT_WALLPAPER_NAME.DEEP_SEA,
    colors: ['#4dbfc0', '#223148'],
    angle: 132,
    spread: 78,
  },
  [GRADIENT_WALLPAPER_NAME.TANGERINE]: {
    version: 1,
    kind: GRADIENT_TYPE.LINEAR,
    preset: GRADIENT_WALLPAPER_NAME.TANGERINE,
    colors: ['#ffc767', '#ff7834'],
    angle: 124,
    spread: 70,
  },
  [GRADIENT_WALLPAPER_NAME.NEXT_GLOW]: {
    version: 1,
    kind: GRADIENT_TYPE.RADIAL,
    preset: GRADIENT_WALLPAPER_NAME.NEXT_GLOW,
    colors: ['#d79bc6', '#5f6fb3', '#4d3b70', '#272f55'],
    center: { x: 0.48, y: 0.22 },
    radius: 96,
    shape: 'ellipse',
    spread: 78,
  },
  [GRADIENT_WALLPAPER_NAME.AURORA]: {
    version: 2,
    kind: GRADIENT_TYPE.MESH,
    preset: GRADIENT_WALLPAPER_NAME.AURORA,
    seed: 18435,
    model: MESH_GRADIENT_MODEL.FLOW,
    colors: ['#24143e', '#0c5878', '#2b8c90', '#ff746d', '#ffc66d', '#5b2f65'],
    flow: 92,
    softness: 94,
    warp: 42,
    scale: 34,
    contrast: 118,
    brightness: 108,
  },
  [GRADIENT_WALLPAPER_NAME.LAGOON]: {
    version: 2,
    kind: GRADIENT_TYPE.MESH,
    preset: GRADIENT_WALLPAPER_NAME.LAGOON,
    seed: 73291,
    model: MESH_GRADIENT_MODEL.LIQUID,
    colors: ['#ffd8cb', '#fff0cf', '#ff6338', '#a8d7ff', '#f1aaa2'],
    flow: 18,
    softness: 92,
    warp: 68,
    scale: 28,
    contrast: 112,
    brightness: 108,
  },
} satisfies Record<string, TGradientRecipe>

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
