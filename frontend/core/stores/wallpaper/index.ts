import { proxy } from 'valtio'
import { mergeLeft, mergeDeepRight } from 'ramda'

import type { TWallpaperGradientDir } from '~/spec'
import { WALLPAPER_TYPE } from '~/const/wallpaper'

import type { TStore, TInitState } from './spec'

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

export default (initState: TInitState = {}): TStore => {
  const store = proxy(
    mergeLeft(initState, {
      ...INITIAL_WALLPAPER_STATE,
      // for edit/rollback in dashboard
      original: INITIAL_WALLPAPER_STATE,

      commit: (patch: Partial<TStore>): void => {
        Object.assign(store, mergeDeepRight(store, patch))
      },
    }),
  )

  return store
}
