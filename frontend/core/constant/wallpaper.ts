import { GRADIENT_RENDERER, type TGradientRecipe } from '~/lib/wallpaperMesh'
import type { TGradientEffectInit, TGradientPalette, TWallpaper } from '~/spec'

export { PATTERN_WALLPAPER, WALLPAPER_PATTERN } from './wallpaper.generated'

export const DEFAULT_WALLPAPER_PATTERN_ID = '01'

export enum WALLPAPER_PATTERN_TONE {
  DARK = 'dark',
  LIGHT = 'light',
}

export const WALLPAPER_STATE_KEYS = [
  'customWallpaper',
  'source',
  'type',
  'sourceDark',
  'typeDark',
  'hasPattern',
  'patternId',
  'patternIntensity',
  'patternTone',
  'hasTexture',
  'hasPatternDark',
  'patternIdDark',
  'patternIntensityDark',
  'patternToneDark',
  'hasTextureDark',
  'blurIntensity',
  'hasShadow',
  'brightness',
  'saturation',
  'blurIntensityDark',
  'hasShadowDark',
  'brightnessDark',
  'saturationDark',
  'gradient',
  'gradientDark',
  'texture',
  'textureDark',
  'bgSize',
  'bgSizeDark',
] as const

export const WALLPAPER_SAVABLE_STATE_KEYS = [
  'source',
  'type',
  'sourceDark',
  'typeDark',
  'hasPattern',
  'patternId',
  'patternIntensity',
  'patternTone',
  'hasTexture',
  'hasPatternDark',
  'patternIdDark',
  'patternIntensityDark',
  'patternToneDark',
  'hasTextureDark',
  'blurIntensity',
  'hasShadow',
  'brightness',
  'saturation',
  'blurIntensityDark',
  'hasShadowDark',
  'brightnessDark',
  'saturationDark',
  'gradient',
  'gradientDark',
  'texture',
  'textureDark',
  'bgSize',
  'bgSizeDark',
] as const

export enum WALLPAPER_TYPE {
  PATTERN = 'picture',
  GRADIENT = 'gradient',
  UPLOAD = 'upload',
  NONE = 'none',
}

export enum WALLPAPER_BG_SIZE {
  COVER = 'cover',
  CONTAIN = 'contain',
  AUTO = 'auto',
}

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
  AMBER_MAUVE: 'amber_mauve',
  STONE_GREEN: 'stone_green',
  AMBER_ROSE: 'amber_rose',
  TEAL_INDIGO_MAUVE: 'teal_indigo_mauve',
  SKY_MAUVE_BLUE: 'sky_mauve_blue',
  OLIVE_GREEN: 'olive_green',
  STONE_TAUPE: 'stone_taupe',
  EMERALD_OLIVE: 'emerald_olive',
  CYAN_SLATE: 'cyan_slate',
  AMBER_ORANGE: 'amber_orange',
  PINK_INDIGO_VIOLET: 'pink_indigo_violet',
  VIOLET_TEAL_AMBER: 'violet_teal_amber',
  ROSE_AMBER_SKY: 'rose_amber_sky',
  SLATE_ROSE_GREEN: 'slate_rose_green',
  VIOLET_ROSE_MAUVE: 'violet_rose_mauve',
  SKY_ORANGE_SLATE: 'sky_orange_slate',
  SLATE_FUCHSIA_AMBER: 'slate_fuchsia_amber',
  SLATE_ORANGE_CYAN: 'slate_orange_cyan',
  ZINC_ORANGE_CYAN: 'zinc_orange_cyan',
  MIST_ROSE_GREEN: 'mist_rose_green',
  ORANGE_AMBER_VIOLET: 'orange_amber_violet',
  INDIGO_RED_AMBER: 'indigo_red_amber',
  SLATE_TEAL_EMERALD: 'slate_teal_emerald',
  SLATE_CYAN_AMBER: 'slate_cyan_amber',
  EMERALD_AMBER_ROSE: 'emerald_amber_rose',
  RED_SKY: 'red_sky',
  ROSE_SKY_MAUVE: 'rose_sky_mauve',
  MIST_ROSE_SLATE: 'mist_rose_slate',
  MIST_GREEN_AMBER: 'mist_green_amber',
  SKY_MAUVE_SLATE: 'sky_mauve_slate',
} as const

const DEFAULT_GRADIENT_EFFECT_INIT = {
  angle: 180,
  spread: 58,
} satisfies TGradientEffectInit

export const GRADIENT_PALETTE = {
  [GRADIENT_WALLPAPER_NAME.AMBER_MAUVE]: {
    key: GRADIENT_WALLPAPER_NAME.AMBER_MAUVE,
    label: 'Amber Mauve',
    colors: ['#FBEFDE', '#D8B9E3'],
  },
  [GRADIENT_WALLPAPER_NAME.STONE_GREEN]: {
    key: GRADIENT_WALLPAPER_NAME.STONE_GREEN,
    label: 'Stone Green',
    colors: ['#D6D9B8', '#87BB89'],
  },
  [GRADIENT_WALLPAPER_NAME.AMBER_ROSE]: {
    key: GRADIENT_WALLPAPER_NAME.AMBER_ROSE,
    label: 'Amber Rose',
    colors: ['#ffefc4', '#c06577'],
  },
  [GRADIENT_WALLPAPER_NAME.TEAL_INDIGO_MAUVE]: {
    key: GRADIENT_WALLPAPER_NAME.TEAL_INDIGO_MAUVE,
    label: 'Teal Indigo Mauve',
    colors: ['#69999F', '#6B80A7', '#8C8EBB'],
  },
  [GRADIENT_WALLPAPER_NAME.SKY_MAUVE_BLUE]: {
    key: GRADIENT_WALLPAPER_NAME.SKY_MAUVE_BLUE,
    label: 'Sky Mauve Blue',
    colors: ['#daf3fb', '#B8D1FA', '#c7bbf2', '#6390c5'],
  },
  [GRADIENT_WALLPAPER_NAME.OLIVE_GREEN]: {
    key: GRADIENT_WALLPAPER_NAME.OLIVE_GREEN,
    label: 'Olive Green',
    colors: ['#4f6851', '#203a27'],
  },
  [GRADIENT_WALLPAPER_NAME.STONE_TAUPE]: {
    key: GRADIENT_WALLPAPER_NAME.STONE_TAUPE,
    label: 'Stone Taupe',
    colors: ['#e6cda7', '#b58a58'],
  },
  [GRADIENT_WALLPAPER_NAME.EMERALD_OLIVE]: {
    key: GRADIENT_WALLPAPER_NAME.EMERALD_OLIVE,
    label: 'Emerald Olive',
    colors: ['#5fcf94', '#9a9634'],
  },
  [GRADIENT_WALLPAPER_NAME.CYAN_SLATE]: {
    key: GRADIENT_WALLPAPER_NAME.CYAN_SLATE,
    label: 'Cyan Slate',
    colors: ['#4dbfc0', '#223148'],
  },
  [GRADIENT_WALLPAPER_NAME.AMBER_ORANGE]: {
    key: GRADIENT_WALLPAPER_NAME.AMBER_ORANGE,
    label: 'Amber Orange',
    colors: ['#ffc767', '#ff7834'],
  },
  [GRADIENT_WALLPAPER_NAME.PINK_INDIGO_VIOLET]: {
    key: GRADIENT_WALLPAPER_NAME.PINK_INDIGO_VIOLET,
    label: 'Pink Indigo Violet',
    colors: ['#d79bc6', '#5f6fb3', '#4d3b70', '#272f55'],
  },
  [GRADIENT_WALLPAPER_NAME.VIOLET_TEAL_AMBER]: {
    key: GRADIENT_WALLPAPER_NAME.VIOLET_TEAL_AMBER,
    label: 'Violet Teal Amber',
    colors: ['#24143e', '#0c5878', '#2b8c90', '#ff746d', '#ffc66d', '#5b2f65'],
  },
  [GRADIENT_WALLPAPER_NAME.ROSE_AMBER_SKY]: {
    key: GRADIENT_WALLPAPER_NAME.ROSE_AMBER_SKY,
    label: 'Rose Amber Sky',
    colors: ['#ffd8cb', '#fff0cf', '#ff6338', '#a8d7ff', '#f1aaa2'],
  },
  [GRADIENT_WALLPAPER_NAME.SLATE_ROSE_GREEN]: {
    key: GRADIENT_WALLPAPER_NAME.SLATE_ROSE_GREEN,
    label: 'Slate Rose Green',
    colors: ['#050716', '#4C093B', '#F6D9BC', '#9CCB8D'],
  },
  [GRADIENT_WALLPAPER_NAME.VIOLET_ROSE_MAUVE]: {
    key: GRADIENT_WALLPAPER_NAME.VIOLET_ROSE_MAUVE,
    label: 'Violet Rose Mauve',
    colors: ['#52308B', '#C45493', '#D5B4DE', '#F0A2C4'],
  },
  [GRADIENT_WALLPAPER_NAME.SKY_ORANGE_SLATE]: {
    key: GRADIENT_WALLPAPER_NAME.SKY_ORANGE_SLATE,
    label: 'Sky Orange Slate',
    colors: ['#BBD6DD', '#EC4B0C', '#F7C27A', '#2D5570'],
  },
  [GRADIENT_WALLPAPER_NAME.SLATE_FUCHSIA_AMBER]: {
    key: GRADIENT_WALLPAPER_NAME.SLATE_FUCHSIA_AMBER,
    label: 'Slate Fuchsia Amber',
    colors: ['#020817', '#8A22DA', '#FF2B8C', '#FFBC44'],
  },
  [GRADIENT_WALLPAPER_NAME.SLATE_ORANGE_CYAN]: {
    key: GRADIENT_WALLPAPER_NAME.SLATE_ORANGE_CYAN,
    label: 'Slate Orange Cyan',
    colors: ['#020405', '#F26A2F', '#E8D6D8', '#0E6D90'],
  },
  [GRADIENT_WALLPAPER_NAME.ZINC_ORANGE_CYAN]: {
    key: GRADIENT_WALLPAPER_NAME.ZINC_ORANGE_CYAN,
    label: 'Zinc Orange Cyan',
    colors: ['#171A1F', '#FF9247', '#F8FBFF', '#57D8EC'],
  },
  [GRADIENT_WALLPAPER_NAME.MIST_ROSE_GREEN]: {
    key: GRADIENT_WALLPAPER_NAME.MIST_ROSE_GREEN,
    label: 'Mist Rose Green',
    colors: ['#DCEEF2', '#F4D4DB', '#D7D5C8', '#72BF98'],
  },
  [GRADIENT_WALLPAPER_NAME.ORANGE_AMBER_VIOLET]: {
    key: GRADIENT_WALLPAPER_NAME.ORANGE_AMBER_VIOLET,
    label: 'Orange Amber Violet',
    colors: ['#D94D2B', '#E9B879', '#B5A9D6', '#4A1737'],
  },
  [GRADIENT_WALLPAPER_NAME.INDIGO_RED_AMBER]: {
    key: GRADIENT_WALLPAPER_NAME.INDIGO_RED_AMBER,
    label: 'Indigo Red Amber',
    colors: ['#30477A', '#FF5145', '#FFB84E', '#B93368'],
  },
  [GRADIENT_WALLPAPER_NAME.SLATE_TEAL_EMERALD]: {
    key: GRADIENT_WALLPAPER_NAME.SLATE_TEAL_EMERALD,
    label: 'Slate Teal Emerald',
    colors: ['#07130F', '#0C6B69', '#B8E7E4', '#65C987'],
  },
  [GRADIENT_WALLPAPER_NAME.SLATE_CYAN_AMBER]: {
    key: GRADIENT_WALLPAPER_NAME.SLATE_CYAN_AMBER,
    label: 'Slate Cyan Amber',
    colors: ['#020608', '#214B5A', '#7BAEBB', '#E9D2A2'],
  },
  [GRADIENT_WALLPAPER_NAME.EMERALD_AMBER_ROSE]: {
    key: GRADIENT_WALLPAPER_NAME.EMERALD_AMBER_ROSE,
    label: 'Emerald Amber Rose',
    colors: ['#69B59F', '#F5E9D0', '#E6BE55', '#E86E86'],
  },
  [GRADIENT_WALLPAPER_NAME.RED_SKY]: {
    key: GRADIENT_WALLPAPER_NAME.RED_SKY,
    label: 'Red Sky',
    colors: ['#F7F7F4', '#E15B57', '#9FBCC2', '#B9D9E4'],
  },
  [GRADIENT_WALLPAPER_NAME.ROSE_SKY_MAUVE]: {
    key: GRADIENT_WALLPAPER_NAME.ROSE_SKY_MAUVE,
    label: 'Rose Sky Mauve',
    colors: ['#F5E5E8', '#FF8E86', '#9ABDE7', '#AC70A6'],
  },
  [GRADIENT_WALLPAPER_NAME.MIST_ROSE_SLATE]: {
    key: GRADIENT_WALLPAPER_NAME.MIST_ROSE_SLATE,
    label: 'Mist Rose Slate',
    colors: ['#E8EDF4', '#E3C0BE', '#8F8AA4', '#223A56'],
  },
  [GRADIENT_WALLPAPER_NAME.MIST_GREEN_AMBER]: {
    key: GRADIENT_WALLPAPER_NAME.MIST_GREEN_AMBER,
    label: 'Mist Green Amber',
    colors: ['#DCEFE9', '#EEF2DD', '#F5E0AD'],
  },
  [GRADIENT_WALLPAPER_NAME.SKY_MAUVE_SLATE]: {
    key: GRADIENT_WALLPAPER_NAME.SKY_MAUVE_SLATE,
    label: 'Sky Mauve Slate',
    colors: ['#8EA5D5', '#C6D5EE', '#8E7898', '#27375F'],
  },
} satisfies Record<string, TGradientPalette>

const GRADIENT_EFFECT_INIT: Record<string, TGradientEffectInit> = {
  [GRADIENT_WALLPAPER_NAME.AMBER_MAUVE]: { angle: 180, spread: 52 },
  [GRADIENT_WALLPAPER_NAME.STONE_GREEN]: { angle: 180, spread: 58 },
  [GRADIENT_WALLPAPER_NAME.AMBER_ROSE]: { angle: 180, spread: 48 },
  [GRADIENT_WALLPAPER_NAME.TEAL_INDIGO_MAUVE]: { angle: 180, spread: 62 },
  [GRADIENT_WALLPAPER_NAME.SKY_MAUVE_BLUE]: { angle: 180, spread: 58 },
  [GRADIENT_WALLPAPER_NAME.OLIVE_GREEN]: { angle: 112, spread: 74 },
  [GRADIENT_WALLPAPER_NAME.STONE_TAUPE]: { angle: 118, spread: 72 },
  [GRADIENT_WALLPAPER_NAME.EMERALD_OLIVE]: { angle: 116, spread: 68 },
  [GRADIENT_WALLPAPER_NAME.CYAN_SLATE]: { angle: 132, spread: 78 },
  [GRADIENT_WALLPAPER_NAME.AMBER_ORANGE]: { angle: 124, spread: 70 },
  [GRADIENT_WALLPAPER_NAME.PINK_INDIGO_VIOLET]: { angle: 128, spread: 78 },
  [GRADIENT_WALLPAPER_NAME.VIOLET_TEAL_AMBER]: { angle: 92, spread: 94 },
  [GRADIENT_WALLPAPER_NAME.ROSE_AMBER_SKY]: { angle: 18, spread: 92 },
  [GRADIENT_WALLPAPER_NAME.SLATE_ROSE_GREEN]: { angle: 38, spread: 88 },
  [GRADIENT_WALLPAPER_NAME.VIOLET_ROSE_MAUVE]: { angle: 132, spread: 72 },
  [GRADIENT_WALLPAPER_NAME.SKY_ORANGE_SLATE]: { angle: 155, spread: 82 },
  [GRADIENT_WALLPAPER_NAME.SLATE_FUCHSIA_AMBER]: { angle: 180, spread: 90 },
  [GRADIENT_WALLPAPER_NAME.SLATE_ORANGE_CYAN]: { angle: 135, spread: 80 },
  [GRADIENT_WALLPAPER_NAME.ZINC_ORANGE_CYAN]: { angle: 45, spread: 86 },
  [GRADIENT_WALLPAPER_NAME.MIST_ROSE_GREEN]: { angle: 90, spread: 68 },
  [GRADIENT_WALLPAPER_NAME.ORANGE_AMBER_VIOLET]: { angle: 145, spread: 76 },
  [GRADIENT_WALLPAPER_NAME.INDIGO_RED_AMBER]: { angle: 90, spread: 84 },
  [GRADIENT_WALLPAPER_NAME.SLATE_TEAL_EMERALD]: { angle: 120, spread: 76 },
  [GRADIENT_WALLPAPER_NAME.SLATE_CYAN_AMBER]: { angle: 130, spread: 78 },
  [GRADIENT_WALLPAPER_NAME.EMERALD_AMBER_ROSE]: { angle: 25, spread: 74 },
  [GRADIENT_WALLPAPER_NAME.RED_SKY]: { angle: 180, spread: 70 },
  [GRADIENT_WALLPAPER_NAME.ROSE_SKY_MAUVE]: { angle: 135, spread: 72 },
  [GRADIENT_WALLPAPER_NAME.MIST_ROSE_SLATE]: { angle: 180, spread: 74 },
  [GRADIENT_WALLPAPER_NAME.MIST_GREEN_AMBER]: { angle: 180, spread: 66 },
  [GRADIENT_WALLPAPER_NAME.SKY_MAUVE_SLATE]: { angle: 180, spread: 78 },
} satisfies Record<string, TGradientEffectInit>

const buildGradientWallpaper = (palette: TGradientPalette): TGradientRecipe => ({
  version: 2,
  renderer: GRADIENT_RENDERER.LINEAR,
  preset: palette.key,
  colors: palette.colors,
  ...(GRADIENT_EFFECT_INIT[palette.key] ?? DEFAULT_GRADIENT_EFFECT_INIT),
})

export const GRADIENT_WALLPAPER = Object.fromEntries(
  Object.values(GRADIENT_PALETTE).map((palette) => [palette.key, buildGradientWallpaper(palette)]),
) as Record<string, TGradientRecipe>

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
