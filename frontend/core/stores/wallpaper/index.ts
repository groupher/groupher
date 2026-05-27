import { proxy } from 'valtio'

import { WALLPAPER_TYPE } from '~/const/wallpaper'
import type { TImageTextureType } from '~/lib/wallpaperMesh'
import type { TWallpaperGradientDir } from '~/spec'

import type { TInit, TStore } from './spec'

export const INITIAL_WALLPAPER_STATE = {
  customWallpaper: null,
  customColorValue: '',
  source: 'pink',
  type: WALLPAPER_TYPE.GRADIENT,
  hasPattern: true,
  blurIntensity: 0,
  hasShadow: false,
  brightness: 100,
  saturation: 100,
  textureType: 'grain' as TImageTextureType,
  textureStrength: 0,
  direction: '180deg' as TWallpaperGradientDir,
  bgSize: 'cover',
}

export default (init: TInit = {}): TStore => {
  const initialStore: TStore = {
    original: INITIAL_WALLPAPER_STATE,

    ...INITIAL_WALLPAPER_STATE,
    ...init,

    commit: (patch: Partial<TStore>): void => {
      Object.assign(store, patch)
    },
  }

  const store = proxy(initialStore)
  return store
}
