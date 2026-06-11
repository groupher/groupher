import { clone } from 'ramda'

import {
  DEFAULT_WALLPAPER_PATTERN_ID,
  GRADIENT_WALLPAPER,
  WALLPAPER_PATTERN_TONE,
  WALLPAPER_TYPE,
} from '~/const/wallpaper'
import { WALLPAPER_TEXTURE } from '~/lib/wallpaperMesh'

import type { TWallpaperState, TWallpaperThemeState } from './spec'

export const WALLPAPER_THEME_STATE_KEYS = [
  'customWallpaper',
  'source',
  'type',
  'pattern',
  'contentShadow',
  'effect',
  'gradient',
  'texture',
] as const

export const WALLPAPER_SAVABLE_THEME_STATE_KEYS = [
  'source',
  'type',
  'pattern',
  'contentShadow',
  'effect',
  'gradient',
  'texture',
] as const

export const WALLPAPER_STATE_KEYS = ['light', 'dark'] as const
export const WALLPAPER_SAVABLE_STATE_KEYS = ['light', 'dark'] as const

export const INITIAL_WALLPAPER_THEME_STATE = {
  customWallpaper: null,
  source: 'amber_mauve',
  type: WALLPAPER_TYPE.GRADIENT,
  pattern: {
    enabled: true,
    id: DEFAULT_WALLPAPER_PATTERN_ID,
    intensity: 50,
    tone: WALLPAPER_PATTERN_TONE.DARK,
  },
  contentShadow: {
    enabled: false,
  },
  gradient: GRADIENT_WALLPAPER.amber_mauve,
  effect: {
    blurIntensity: 0,
    brightness: 100,
    saturation: 100,
  },
  texture: { enabled: false, type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
} satisfies TWallpaperThemeState

export const INITIAL_WALLPAPER_STATE = {
  light: clone(INITIAL_WALLPAPER_THEME_STATE),
  dark: clone(INITIAL_WALLPAPER_THEME_STATE),
} satisfies TWallpaperState
