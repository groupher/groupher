import { proxy } from 'valtio'

import { WALLPAPER_TYPE } from '~/const/wallpaper'
import type { TWallpaperGradientDir } from '~/spec'

import type { TInit, TStore } from './spec'

export const INITIAL_WALLPAPER_STATE = {
  customWallpaper: null,
  customColorValue: '',
  source: 'pink',
  type: WALLPAPER_TYPE.GRADIENT,
  hasPattern: true,
  hasBlur: false,
  hasShadow: false,
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
