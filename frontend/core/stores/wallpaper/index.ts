import { pick } from 'ramda'
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
  source: 'pink',
  type: WALLPAPER_TYPE.GRADIENT,
  hasPattern: true,
  patternId: DEFAULT_WALLPAPER_PATTERN_ID,
  patternIntensity: 50,
  patternTone: WALLPAPER_PATTERN_TONE.DARK,
  hasTexture: false,
  gradient: GRADIENT_WALLPAPER.pink,
  blurIntensity: 0,
  hasShadow: false,
  brightness: 100,
  saturation: 100,
  texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
  bgSize: WALLPAPER_BG_SIZE.COVER,
} satisfies TWallpaperState

const resolveInitialWallpaperState = (init: TInit): TWallpaperState => {
  const state = {
    ...INITIAL_WALLPAPER_STATE,
    ...pick(WALLPAPER_STATE_KEYS, init),
  }

  if (state.type === WALLPAPER_TYPE.GRADIENT && !state.gradient) {
    state.gradient = GRADIENT_WALLPAPER[state.source] ?? GRADIENT_WALLPAPER.pink
  }

  return state
}

export default (init: TInit = {}): TStore => {
  const initialState = resolveInitialWallpaperState(init)
  const initialStore: TStore = {
    original: initialState,
    ...initialState,

    commit: (patch: Partial<TStore>): void => {
      Object.assign(store, patch)
    },
  }

  const store = proxy(initialStore)
  return store
}
