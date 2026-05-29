import { GRADIENT_TYPE, type TGradientRecipe } from '~/lib/wallpaperMesh'
import type { TWallpaper } from '~/spec'

export { PATTERN_WALLPAPER } from './wallpaper.generated'

export const WALLPAPER_STATE_KEYS = [
  'customWallpaper',
  'source',
  'type',
  'hasPattern',
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
  PASTEL: 'pastel',
  MEADOW: 'meadow',
  AURORA: 'aurora',
  SUNSET: 'sunset',
  OCEAN: 'ocean',
  BLOOM: 'bloom',
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
  [GRADIENT_WALLPAPER_NAME.GREY]: {
    version: 1,
    kind: GRADIENT_TYPE.RADIAL,
    preset: GRADIENT_WALLPAPER_NAME.GREY,
    colors: ['#EEEBE8', '#E7E2DD', '#dccfc2'],
    center: { x: 0.5, y: 0.44 },
    radius: 72,
    shape: 'ellipse',
    spread: 64,
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
  [GRADIENT_WALLPAPER_NAME.PASTEL]: {
    version: 1,
    kind: GRADIENT_TYPE.MESH,
    preset: GRADIENT_WALLPAPER_NAME.PASTEL,
    seed: 18432,
    colors: ['#fbeede', '#d8b9e3', '#f9fbff'],
    flow: 180,
    softness: 82,
    contrast: 100,
    brightness: 100,
    anchors: [
      { x: 0.5, y: 0.02, color: 0, shape: 'ellipse', spread: 72, scaleX: 1.35 },
      { x: 0.5, y: 0.98, color: 1, shape: 'circle', spread: 76 },
      { x: 0.92, y: 0.5, color: 2, shape: 'band', spread: 62, rotate: 22, opacity: 0.52 },
    ],
  },
  [GRADIENT_WALLPAPER_NAME.MEADOW]: {
    version: 1,
    kind: GRADIENT_TYPE.MESH,
    preset: GRADIENT_WALLPAPER_NAME.MEADOW,
    seed: 18432,
    colors: ['#d6d9b8', '#87bb89', '#eef6df'],
    flow: 90,
    softness: 78,
    contrast: 100,
    brightness: 100,
    anchors: [
      { x: 0.02, y: 0.5, color: 0, shape: 'corner', spread: 78 },
      { x: 0.98, y: 0.5, color: 1, shape: 'ellipse', spread: 72, scaleY: 1.35 },
      { x: 0.58, y: 0.12, color: 2, shape: 'band', spread: 56, rotate: 88, opacity: 0.5 },
    ],
  },
  [GRADIENT_WALLPAPER_NAME.AURORA]: {
    version: 1,
    kind: GRADIENT_TYPE.MESH,
    preset: GRADIENT_WALLPAPER_NAME.AURORA,
    seed: 18432,
    colors: ['#6f94db', '#64b2f4', '#83e4eb', '#dff8f2'],
    flow: 45,
    softness: 66,
    contrast: 100,
    brightness: 100,
    anchors: [
      { x: 0.08, y: 0.12, color: 0, shape: 'circle', spread: 54 },
      { x: 0.24, y: 0.82, color: 1, shape: 'band', spread: 64, rotate: -28, opacity: 0.58 },
      { x: 0.9, y: 0.72, color: 2, shape: 'ellipse', spread: 60, scaleX: 1.45 },
      { x: 0.6, y: 0.22, color: 3, shape: 'corner', spread: 52 },
    ],
  },
  [GRADIENT_WALLPAPER_NAME.SUNSET]: {
    version: 1,
    kind: GRADIENT_TYPE.MESH,
    preset: GRADIENT_WALLPAPER_NAME.SUNSET,
    seed: 18432,
    colors: ['#ffefc4', '#ff9b80', '#c06577', '#6b80a7'],
    flow: 135,
    softness: 54,
    contrast: 100,
    brightness: 100,
    anchors: [
      { x: 0.12, y: 0.16, color: 0, shape: 'corner', spread: 58 },
      { x: 0.35, y: 0.78, color: 1, shape: 'circle', spread: 46 },
      { x: 0.86, y: 0.2, color: 2, shape: 'ellipse', spread: 64, scaleY: 1.25 },
      { x: 0.82, y: 0.84, color: 3, shape: 'band', spread: 54, rotate: -42 },
    ],
  },
  [GRADIENT_WALLPAPER_NAME.OCEAN]: {
    version: 1,
    kind: GRADIENT_TYPE.MESH,
    preset: GRADIENT_WALLPAPER_NAME.OCEAN,
    seed: 18432,
    colors: ['#d9f8ff', '#79d7f0', '#4f8bd8', '#233a7b'],
    flow: 160,
    softness: 72,
    contrast: 100,
    brightness: 100,
    anchors: [
      { x: 0.18, y: 0.18, color: 0, shape: 'ellipse', spread: 60, scaleX: 1.4 },
      { x: 0.52, y: 0.46, color: 1, shape: 'band', spread: 72, rotate: 18 },
      { x: 0.78, y: 0.78, color: 2, shape: 'circle', spread: 58 },
      { x: 0.88, y: 0.92, color: 3, shape: 'corner', spread: 68 },
    ],
  },
  [GRADIENT_WALLPAPER_NAME.BLOOM]: {
    version: 1,
    kind: GRADIENT_TYPE.MESH,
    preset: GRADIENT_WALLPAPER_NAME.BLOOM,
    seed: 18432,
    colors: ['#ffe7a3', '#ff9f1c', '#24c486', '#00a6c8'],
    flow: 125,
    softness: 58,
    contrast: 100,
    brightness: 100,
    anchors: [
      { x: 0.18, y: 0.16, color: 0, shape: 'circle', spread: 44 },
      { x: 0.48, y: 0.2, color: 1, shape: 'ellipse', spread: 58, scaleX: 1.6 },
      { x: 0.55, y: 0.66, color: 2, shape: 'band', spread: 74, rotate: -18 },
      { x: 0.86, y: 0.9, color: 3, shape: 'corner', spread: 64 },
    ],
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
