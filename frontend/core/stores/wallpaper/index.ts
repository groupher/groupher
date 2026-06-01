import { clone, pick } from 'ramda'
import { proxy } from 'valtio'

import {
  DEFAULT_WALLPAPER_PATTERN_ID,
  GRADIENT_WALLPAPER,
  WALLPAPER_BG_SIZE,
  WALLPAPER_PATTERN_TONE,
  WALLPAPER_STATE_KEYS,
  WALLPAPER_TYPE,
} from '~/const/wallpaper'
import { WALLPAPER_TEXTURE } from '~/lib/wallpaperMesh'

import type { TInit, TStore, TWallpaperState } from './spec'

export const INITIAL_WALLPAPER_STATE = {
  customWallpaper: null,
  source: 'amber_mauve',
  type: WALLPAPER_TYPE.GRADIENT,
  sourceDark: 'amber_mauve',
  typeDark: WALLPAPER_TYPE.GRADIENT,
  hasPattern: true,
  patternId: DEFAULT_WALLPAPER_PATTERN_ID,
  patternIntensity: 50,
  patternTone: WALLPAPER_PATTERN_TONE.DARK,
  hasTexture: false,
  hasPatternDark: true,
  patternIdDark: DEFAULT_WALLPAPER_PATTERN_ID,
  patternIntensityDark: 50,
  patternToneDark: WALLPAPER_PATTERN_TONE.DARK,
  hasTextureDark: false,
  gradient: GRADIENT_WALLPAPER.amber_mauve,
  gradientDark: GRADIENT_WALLPAPER.amber_mauve,
  blurIntensity: 0,
  hasShadow: false,
  brightness: 100,
  saturation: 100,
  blurIntensityDark: 0,
  hasShadowDark: false,
  brightnessDark: 100,
  saturationDark: 100,
  texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
  textureDark: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
  bgSize: WALLPAPER_BG_SIZE.COVER,
  bgSizeDark: WALLPAPER_BG_SIZE.COVER,
} satisfies TWallpaperState

const resolveInitialWallpaperState = (init: TInit): TWallpaperState => {
  const state = {
    ...INITIAL_WALLPAPER_STATE,
    ...pick(WALLPAPER_STATE_KEYS, init),
  }

  if (state.type === WALLPAPER_TYPE.GRADIENT && !state.gradient) {
    state.gradient = GRADIENT_WALLPAPER[state.source] ?? GRADIENT_WALLPAPER.amber_mauve
  }
  if (state.typeDark === WALLPAPER_TYPE.GRADIENT && !state.gradientDark) {
    state.gradientDark = GRADIENT_WALLPAPER[state.sourceDark] ?? GRADIENT_WALLPAPER.amber_mauve
  }

  return state
}

export default (init: TInit = {}): TStore => {
  const initialState = resolveInitialWallpaperState(init)
  const initialStore: TStore = {
    // Keep the saved baseline isolated from live nested edits used by diff patches.
    original: clone(initialState),
    ...clone(initialState),

    commit: (patch: Partial<TStore>): void => {
      Object.assign(store, patch)
    },
  }

  const store = proxy(initialStore)
  return store
}
