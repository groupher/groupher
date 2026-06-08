import { clone, forEach, keys, mergeDeepRight, pick } from 'ramda'
import { proxy, useSnapshot } from 'valtio'

import { COVER_GRADIENT_WALLPAPER, GRADIENT_DIRECTION } from '~/const/wallpaper'
import type { TWallpaper, TWallpaperGradient, TWallpaperGradientDir } from '~/spec'

import {
  BORDER_HIGHLIGHT_DEFAULT,
  COVER_SHADOW_DEFAULT,
  IMAGE_SIZE_RANGE,
  MAGNIFIER_RADIUS_DEFAULT,
  MAGNIFIER_ZOOM_DEFAULT,
} from './constant'
import type {
  TBorderHighlight,
  TCoverPoint,
  TCoverShadow,
  TImageSize,
  TStore,
  TTuningSetting,
} from './spec'

type TRet = {
  imageLoadedOnChange: (imageUrl: string) => void
  positionOnChange: (position: TCoverPoint) => void
  shadowOnChange: (shadow: Partial<TCoverShadow>) => void
  borderRadiusOnChange: (borderRadius: number) => void
  borderHighlightOnChange: (borderHighlight: Partial<TBorderHighlight>) => void
  wallpaperOnChange: (wallpaper: string) => void
  gradientDirOnChange: (direction: TWallpaperGradientDir) => void
  sizeOnChange: (size: TImageSize) => void
  rotateOnChange: (rotate: number) => void
  glassBorderOnChange: (hasGlassBorder: boolean) => void
  magnifierRadiationOnChange: (magnifierCenter: TCoverPoint, magnifierRadius: number) => void
  magnifierZoomOnChange: (magnifierZoom: number) => void
  magnifierOnChange: (hasMagnifier: boolean) => void
} & TStore

// Neutral store defaults keep the editor empty-safe; this preset is only applied
// once a real image finishes loading so the first visible cover has a polished frame.
const LOADED_IMAGE_DEFAULT_SETTING: Partial<TStore> = {
  size: 94,
  rotate: 0,
  position: { x: 0.5, y: 0.5 },
  shadow: {
    preset: COVER_SHADOW_DEFAULT.PRESET,
    colorMode: COVER_SHADOW_DEFAULT.COLOR_MODE,
    hue: COVER_SHADOW_DEFAULT.HUE,
    rainbowHue: COVER_SHADOW_DEFAULT.RAINBOW_HUE,
    x: COVER_SHADOW_DEFAULT.X,
    y: COVER_SHADOW_DEFAULT.Y,
    blur: COVER_SHADOW_DEFAULT.BLUR,
    spread: COVER_SHADOW_DEFAULT.SPREAD,
    opacity: COVER_SHADOW_DEFAULT.OPACITY,
  },
  borderRadius: 0,
  borderHighlight: {
    enabled: BORDER_HIGHLIGHT_DEFAULT.ENABLED,
    mode: BORDER_HIGHLIGHT_DEFAULT.MODE,
    angle: BORDER_HIGHLIGHT_DEFAULT.ANGLE,
    length: BORDER_HIGHLIGHT_DEFAULT.LENGTH,
    hue: BORDER_HIGHLIGHT_DEFAULT.HUE,
    rainbowHue: BORDER_HIGHLIGHT_DEFAULT.RAINBOW_HUE,
    saturation: BORDER_HIGHLIGHT_DEFAULT.SATURATION,
    lightness: BORDER_HIGHLIGHT_DEFAULT.LIGHTNESS,
    opacity: BORDER_HIGHLIGHT_DEFAULT.OPACITY,
  },
  hasGlassBorder: false,
  hasMagnifier: false,
  magnifierRadius: MAGNIFIER_RADIUS_DEFAULT,
  magnifierZoom: MAGNIFIER_ZOOM_DEFAULT,
  wallpaper: 'pink',
  direction: GRADIENT_DIRECTION.BOTTOM_RIGHT,
}

const store = proxy<TStore>({
  position: { x: 0.5, y: 0.5 },
  magnifierCenter: { x: 0.5, y: 0.5 },
  magnifierRadius: MAGNIFIER_RADIUS_DEFAULT,
  magnifierZoom: MAGNIFIER_ZOOM_DEFAULT,
  hasMagnifier: false,
  shadow: {
    preset: COVER_SHADOW_DEFAULT.PRESET,
    colorMode: COVER_SHADOW_DEFAULT.COLOR_MODE,
    hue: COVER_SHADOW_DEFAULT.HUE,
    rainbowHue: COVER_SHADOW_DEFAULT.RAINBOW_HUE,
    x: COVER_SHADOW_DEFAULT.X,
    y: COVER_SHADOW_DEFAULT.Y,
    blur: COVER_SHADOW_DEFAULT.BLUR,
    spread: COVER_SHADOW_DEFAULT.SPREAD,
    opacity: COVER_SHADOW_DEFAULT.OPACITY,
  },
  borderRadius: 0,
  borderHighlight: {
    enabled: BORDER_HIGHLIGHT_DEFAULT.ENABLED,
    mode: BORDER_HIGHLIGHT_DEFAULT.MODE,
    angle: BORDER_HIGHLIGHT_DEFAULT.ANGLE,
    length: BORDER_HIGHLIGHT_DEFAULT.LENGTH,
    hue: BORDER_HIGHLIGHT_DEFAULT.HUE,
    rainbowHue: BORDER_HIGHLIGHT_DEFAULT.RAINBOW_HUE,
    saturation: BORDER_HIGHLIGHT_DEFAULT.SATURATION,
    lightness: BORDER_HIGHLIGHT_DEFAULT.LIGHTNESS,
    opacity: BORDER_HIGHLIGHT_DEFAULT.OPACITY,
  },
  size: IMAGE_SIZE_RANGE.MAX,
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
      magnifierCenter,
      magnifierRadius,
      magnifierZoom,
      hasMagnifier,
      shadow,
      borderRadius,
      borderHighlight,
      wallpaper,
      gradientWallpapers,
      direction,
      size,
      rotate,
      hasGlassBorder,
    } = store

    return {
      position,
      magnifierCenter,
      magnifierRadius,
      magnifierZoom,
      hasMagnifier,
      shadow,
      borderRadius,
      borderHighlight,
      wallpapers: gradientWallpapers,
      wallpaper,
      direction: direction as TWallpaperGradientDir,
      size,
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
  const shadowOnChange = (shadow: Partial<TCoverShadow>): void =>
    snap.commit({ shadow: { ...snap.shadow, ...shadow } })
  const borderRadiusOnChange = (borderRadius: number): void => snap.commit({ borderRadius })
  const borderHighlightOnChange = (borderHighlight: Partial<TBorderHighlight>): void =>
    snap.commit({ borderHighlight: { ...snap.borderHighlight, ...borderHighlight } })
  const wallpaperOnChange = (wallpaper: string): void => snap.commit({ wallpaper })
  const gradientDirOnChange = (direction: TWallpaperGradientDir): void => snap.commit({ direction })
  const sizeOnChange = (size: TImageSize): void => snap.commit({ size })
  const rotateOnChange = (rotate: number): void => snap.commit({ rotate })

  const glassBorderOnChange = (hasGlassBorder: boolean) => snap.commit({ hasGlassBorder })

  const magnifierRadiationOnChange = (
    magnifierCenter: TCoverPoint,
    magnifierRadius: number,
  ): void => snap.commit({ magnifierCenter, magnifierRadius, hasMagnifier: true })
  const magnifierZoomOnChange = (magnifierZoom: number): void => snap.commit({ magnifierZoom })
  const magnifierOnChange = (hasMagnifier: boolean): void => snap.commit({ hasMagnifier })

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
    rotateOnChange,
    glassBorderOnChange,
    magnifierRadiationOnChange,
    magnifierZoomOnChange,
    magnifierOnChange,
  }
}
