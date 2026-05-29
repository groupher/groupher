import { WALLPAPER_TYPE } from '~/const/wallpaper'
import type { TWallpaperData, TWallpaperType } from '~/spec'

type TWallpaperSelectionState = Pick<TWallpaperData, 'gradient' | 'source' | 'type'>

export const isActiveWallpaperSource = (
  wallpaper: TWallpaperSelectionState,
  type: TWallpaperType,
  source: string,
): boolean => {
  // Keep per-type drafts around when users browse other tabs, but only show a
  // preset as selected when that wallpaper type is the one currently applied.
  if (wallpaper.type !== type) return false

  if (type === WALLPAPER_TYPE.GRADIENT) {
    return wallpaper.source === source || wallpaper.gradient?.preset === source
  }

  return wallpaper.source === source
}

export const isGradientWallpaper = (wallpaper: Pick<TWallpaperData, 'type'>): boolean => {
  return wallpaper.type === WALLPAPER_TYPE.GRADIENT
}
