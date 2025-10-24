import { mergeDeepRight } from 'ramda'
import { proxy } from 'valtio'
import { WALLPAPER_TYPE } from '~/const/wallpaper'
import type { TWallpaperGradientDir } from '~/spec'

import type { TInit, TStore } from './spec'

export const INITIAL_WALLPAPER_STATE = {
  customWallpaper: null,
  customColorValue: '',
  wallpaper: 'pink',
  wallpaperType: WALLPAPER_TYPE.GRADIENT,
  hasPattern: true,
  hasBlur: false,
  hasShadow: false,
  direction: 'bottom' as TWallpaperGradientDir,
  bgSize: 'cover',
  uploadBgImage: '',
}

export default (init: TInit = {}): TStore => {
  const initialStore: TStore = {
    original: INITIAL_WALLPAPER_STATE,

    ...INITIAL_WALLPAPER_STATE, // 默认值
    ...init, // 用户传入的覆盖值

    commit: (patch: Partial<TStore>): void => {
      Object.assign(initialStore, mergeDeepRight(initialStore, patch))
    },
  }

  const store = proxy(initialStore)
  return store
}
