import { clone, forEach, keys, mergeDeepRight, pick } from 'ramda'
import { proxy, useSnapshot } from 'valtio'

import { COVER_GRADIENT_WALLPAPER, GRADIENT_DIRECTION } from '~/const/wallpaper'
import type { TWallpaper, TWallpaperGradient, TWallpaperGradientDir } from '~/spec'

import { BORDER_HIGHLIGHT_DEFAULT, IMAGE_RATIO, IMAGE_SIZE_RANGE } from './constant'
import type {
  TBorderHighlight,
  TCoverPoint,
  TImageRadio,
  TImageSize,
  TStore,
  TTuningSetting,
} from './spec'

type TRet = {
  imageLoadedOnChange: (imageUrl: string) => void
  positionOnChange: (position: TCoverPoint) => void
  shadowOnChange: (shadow: number) => void
  borderRadiusOnChange: (borderRadius: number) => void
  borderHighlightOnChange: (borderHighlight: Partial<TBorderHighlight>) => void
  wallpaperOnChange: (wallpaper: string) => void
  gradientDirOnChange: (direction: TWallpaperGradientDir) => void
  sizeOnChange: (size: TImageSize) => void
  ratioOnChange: (ratio: TImageRadio) => void
  rotateOnChange: (rotate: number) => void
  glassBorderOnChange: (hasGlassBorder: boolean) => void
  lightCenterOnChange: (lightCenter: TCoverPoint) => void
  lightOnChange: (hasLight: boolean) => void
} & TStore

// Neutral store defaults keep the editor empty-safe; this preset is only applied
// once a real image finishes loading so the first visible cover has a polished frame.
const LOADED_IMAGE_DEFAULT_SETTING: Partial<TStore> = {
  size: 94,
  ratio: IMAGE_RATIO.SCREEN,
  rotate: 0,
  position: { x: 0.5, y: 0.5 },
  shadow: 0,
  borderRadius: 0,
  borderHighlight: {
    enabled: BORDER_HIGHLIGHT_DEFAULT.ENABLED,
    angle: BORDER_HIGHLIGHT_DEFAULT.ANGLE,
    length: BORDER_HIGHLIGHT_DEFAULT.LENGTH,
  },
  hasGlassBorder: false,
  hasLight: false,
  wallpaper: 'pink',
  direction: GRADIENT_DIRECTION.BOTTOM_RIGHT,
}

const store = proxy<TStore>({
  position: { x: 0.5, y: 0.5 },
  lightCenter: { x: 0.5, y: 0.5 },
  hasLight: false,
  shadow: 0,
  borderRadius: 0,
  borderHighlight: {
    enabled: BORDER_HIGHLIGHT_DEFAULT.ENABLED,
    angle: BORDER_HIGHLIGHT_DEFAULT.ANGLE,
    length: BORDER_HIGHLIGHT_DEFAULT.LENGTH,
  },
  size: IMAGE_SIZE_RANGE.MAX,
  ratio: IMAGE_RATIO.SCREEN,
  rotate: 0,
  hasGlassBorder: false,

  // for background
  wallpaper: '',
  hasPattern: false,
  hasBlur: true,
  direction: GRADIENT_DIRECTION.BOTTOM_RIGHT,
  loadedImageUrl: '',

  get gradientWallpapers(): Record<string, TWallpaper> {
    const wallpapers = clone(COVER_GRADIENT_WALLPAPER)
    const paperKeys = keys(COVER_GRADIENT_WALLPAPER)

    forEach((key) => {
      const wallpaperObj = wallpapers[key] as TWallpaperGradient

      wallpaperObj.hasPattern = store.hasPattern
      wallpaperObj.blurIntensity = store.hasBlur ? 60 : 0
      wallpaperObj.direction = store.direction as TWallpaperGradientDir
    }, paperKeys)

    return wallpapers
  },

  get tuningSetting(): TTuningSetting {
    const {
      position,
      lightCenter,
      hasLight,
      shadow,
      borderRadius,
      borderHighlight,
      wallpaper,
      gradientWallpapers,
      direction,
      size,
      ratio,
      rotate,
      hasGlassBorder,
    } = store

    return {
      position,
      lightCenter,
      hasLight,
      shadow,
      borderRadius,
      borderHighlight,
      wallpapers: gradientWallpapers,
      wallpaper,
      direction: direction as TWallpaperGradientDir,
      size,
      ratio: ratio as TImageRadio,
      rotate,
      hasGlassBorder,
    }
  },

  commit: (patch: Partial<TStore>): void => {
    Object.assign(store, mergeDeepRight(store, patch))
  },
})

export default function useLogic(): TRet {
  const snap = useSnapshot(store)

  const imageLoadedOnChange = (imageUrl: string): void => {
    if (!imageUrl || snap.loadedImageUrl === imageUrl) return

    // Apply the polished cover preset only after the actual image succeeds loading.
    // Tracking imageUrl prevents a browser re-load from resetting user tuning edits.
    snap.commit({
      ...LOADED_IMAGE_DEFAULT_SETTING,
      loadedImageUrl: imageUrl,
    })
  }

  const positionOnChange = (position: TCoverPoint): void => snap.commit({ position })
  const shadowOnChange = (shadow: number): void => snap.commit({ shadow })
  const borderRadiusOnChange = (borderRadius: number): void => snap.commit({ borderRadius })
  const borderHighlightOnChange = (borderHighlight: Partial<TBorderHighlight>): void =>
    snap.commit({ borderHighlight: { ...snap.borderHighlight, ...borderHighlight } })
  const wallpaperOnChange = (wallpaper: string): void => snap.commit({ wallpaper })
  const gradientDirOnChange = (direction: TWallpaperGradientDir): void => snap.commit({ direction })
  const sizeOnChange = (size: TImageSize): void => snap.commit({ size })
  const ratioOnChange = (ratio: TImageRadio): void => snap.commit({ ratio })
  const rotateOnChange = (rotate: number): void => snap.commit({ rotate })

  const glassBorderOnChange = (hasGlassBorder: boolean) => snap.commit({ hasGlassBorder })

  const lightCenterOnChange = (lightCenter: TCoverPoint): void =>
    snap.commit({ lightCenter, hasLight: true })
  const lightOnChange = (hasLight: boolean): void => snap.commit({ hasLight })

  return {
    ...pick(keys(snap), snap),
    imageLoadedOnChange,
    positionOnChange,
    shadowOnChange,
    borderRadiusOnChange,
    borderHighlightOnChange,
    wallpaperOnChange,
    gradientDirOnChange,
    sizeOnChange,
    ratioOnChange,
    rotateOnChange,
    glassBorderOnChange,
    lightCenterOnChange,
    lightOnChange,
  }
}
