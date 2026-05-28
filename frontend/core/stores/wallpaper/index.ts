import { pick } from 'ramda'
import { proxy } from 'valtio'

import { WALLPAPER_STATE_KEYS, WALLPAPER_TYPE } from '~/const/wallpaper'
import { WALLPAPER_TEXTURE } from '~/lib/wallpaperMesh'

import type { TInit, TStore, TWallpaperState } from './spec'

export const INITIAL_WALLPAPER_STATE = {
  customWallpaper: null,
  source: 'pink',
  type: WALLPAPER_TYPE.GRADIENT,
  hasPattern: true,
  gradientDeg: 180,
  blurIntensity: 0,
  hasShadow: false,
  brightness: 100,
  saturation: 100,
  mesh: null,
  texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
  bgSize: 'cover',
} satisfies TWallpaperState

const resolveInitialWallpaperState = (init: TInit): TWallpaperState => ({
  ...INITIAL_WALLPAPER_STATE,
  ...pick(WALLPAPER_STATE_KEYS, init),
})

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
