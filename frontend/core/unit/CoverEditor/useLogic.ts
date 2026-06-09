import { clone, equals, keys, mergeDeepRight, pick } from 'ramda'
import { proxy, useSnapshot } from 'valtio'

import { WALLPAPER_TYPE } from '~/const/wallpaper'
import useTheme from '~/hooks/useTheme'
import type { TBgConfig } from '~/lib/bg/spec'
import {
  DEFAULT_WALLPAPER_TEXTURE_INTENSITY,
  GRADIENT_RENDERER,
  buildGradientRecipeForRenderer,
  isMeshGradientRecipe,
  type TGradientRecipe,
  type TGradientRenderer,
  type TWallpaperTexture,
} from '~/lib/wallpaperMesh'

import { buildCoverGradientRecipe, createCoverBgThemeConfig } from './background'
import {
  BORDER_HIGHLIGHT_DEFAULT,
  COVER_SHADOW_DEFAULT,
  IMAGE_SIZE_RANGE,
  MAGNIFIER_APPEARANCE_DEFAULT,
  MAGNIFIER_RADIUS_DEFAULT,
  MAGNIFIER_ZOOM_DEFAULT,
} from './constant'
import type {
  TBorderHighlight,
  TCoverBackgroundPatch,
  TCoverPoint,
  TCoverShadow,
  TImageSize,
  TMagnifierAppearance,
  TStore,
  TTuningSetting,
} from './spec'

type TRet = {
  imageLoadedOnChange: (imageUrl: string, imageDominantColor: string | null) => void
  positionOnChange: (position: TCoverPoint) => void
  shadowOnChange: (shadow: Partial<TCoverShadow>) => void
  borderRadiusOnChange: (borderRadius: number) => void
  borderHighlightOnChange: (borderHighlight: Partial<TBorderHighlight>) => void
  backgroundOnChange: (patch: TCoverBackgroundPatch) => void
  rollbackBackground: () => void
  gradientBackgroundOnChange: (source: string) => void
  pictureBackgroundOnChange: (source: string) => void
  backgroundGradientOnChange: (gradient: TGradientRecipe) => void
  backgroundGradientRendererOnChange: (renderer: TGradientRenderer) => void
  backgroundGradientAngleOnChange: (angle: number) => void
  toggleBackgroundTexture: (hasTexture: boolean) => void
  backgroundTextureOnChange: (texture: TWallpaperTexture) => void
  sizeOnChange: (size: TImageSize) => void
  rotateOnChange: (rotate: number) => void
  glassBorderOnChange: (hasGlassBorder: boolean) => void
  magnifierRadiationOnChange: (magnifierCenter: TCoverPoint, magnifierRadius: number) => void
  magnifierZoomOnChange: (magnifierZoom: number) => void
  magnifierAppearanceOnChange: (magnifierAppearance: Partial<TMagnifierAppearance>) => void
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
  magnifierAppearance: {
    borderColor: MAGNIFIER_APPEARANCE_DEFAULT.BORDER_COLOR,
    borderWidth: MAGNIFIER_APPEARANCE_DEFAULT.BORDER_WIDTH,
    highlightCenter: { ...MAGNIFIER_APPEARANCE_DEFAULT.HIGHLIGHT_CENTER },
    highlightIntensity: MAGNIFIER_APPEARANCE_DEFAULT.HIGHLIGHT_INTENSITY,
    shadow: MAGNIFIER_APPEARANCE_DEFAULT.SHADOW,
  },
  background: createCoverBgThemeConfig(),
  originalBackground: createCoverBgThemeConfig(),
}

const store = proxy<TStore>({
  imageDominantColor: null,
  position: { x: 0.5, y: 0.5 },
  magnifierCenter: { x: 0.5, y: 0.5 },
  magnifierRadius: MAGNIFIER_RADIUS_DEFAULT,
  magnifierZoom: MAGNIFIER_ZOOM_DEFAULT,
  magnifierAppearance: {
    borderColor: MAGNIFIER_APPEARANCE_DEFAULT.BORDER_COLOR,
    borderWidth: MAGNIFIER_APPEARANCE_DEFAULT.BORDER_WIDTH,
    highlightCenter: { ...MAGNIFIER_APPEARANCE_DEFAULT.HIGHLIGHT_CENTER },
    highlightIntensity: MAGNIFIER_APPEARANCE_DEFAULT.HIGHLIGHT_INTENSITY,
    shadow: MAGNIFIER_APPEARANCE_DEFAULT.SHADOW,
  },
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
  background: createCoverBgThemeConfig(),
  originalBackground: createCoverBgThemeConfig(),
  loadedImageUrl: '',

  get tuningSetting(): TTuningSetting {
    const {
      imageDominantColor,
      position,
      magnifierCenter,
      magnifierRadius,
      magnifierZoom,
      magnifierAppearance,
      hasMagnifier,
      shadow,
      borderRadius,
      borderHighlight,
      background,
      originalBackground,
      size,
      rotate,
      hasGlassBorder,
    } = store

    return {
      imageDominantColor,
      position,
      magnifierCenter,
      magnifierRadius,
      magnifierZoom,
      magnifierAppearance,
      hasMagnifier,
      shadow,
      borderRadius,
      borderHighlight,
      background,
      activeBackground: background.light,
      isBackgroundTouched: !equals(clone(originalBackground), clone(background)),
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
  const { isDarkTheme } = useTheme()
  const activeThemeKey = isDarkTheme ? 'dark' : 'light'
  const activeBackground = snap.background[activeThemeKey] as TBgConfig
  const tuningSetting = {
    ...snap.tuningSetting,
    activeBackground,
    isBackgroundTouched: !equals(clone(snap.originalBackground), clone(snap.background)),
  } as TTuningSetting

  const imageLoadedOnChange = (imageUrl: string, imageDominantColor: string | null): void => {
    if (!imageUrl || snap.loadedImageUrl === imageUrl) return
    const background = createCoverBgThemeConfig()

    // Apply the polished cover preset only after the actual image succeeds loading.
    // Tracking imageUrl prevents a browser re-load from resetting user tuning edits.
    snap.commit({
      ...LOADED_IMAGE_DEFAULT_SETTING,
      imageDominantColor,
      loadedImageUrl: imageUrl,
      background,
      originalBackground: clone(background),
    })
  }

  const positionOnChange = (position: TCoverPoint): void => snap.commit({ position })
  const shadowOnChange = (shadow: Partial<TCoverShadow>): void =>
    snap.commit({ shadow: { ...snap.shadow, ...shadow } })
  const borderRadiusOnChange = (borderRadius: number): void => snap.commit({ borderRadius })
  const borderHighlightOnChange = (borderHighlight: Partial<TBorderHighlight>): void =>
    snap.commit({ borderHighlight: { ...snap.borderHighlight, ...borderHighlight } })
  const backgroundOnChange = (patch: TCoverBackgroundPatch): void =>
    snap.commit({
      background: {
        ...snap.background,
        [activeThemeKey]: {
          ...activeBackground,
          ...patch,
        },
      } as TStore['background'],
    })
  const rollbackBackground = (): void =>
    snap.commit({ background: clone(snap.originalBackground) as TStore['background'] })
  const gradientBackgroundOnChange = (source: string): void => {
    const renderer = activeBackground.gradient?.renderer ?? GRADIENT_RENDERER.LINEAR

    backgroundOnChange({
      source,
      type: WALLPAPER_TYPE.GRADIENT,
      gradient: buildCoverGradientRecipe(source, renderer),
      customWallpaper: null,
    })
  }
  const pictureBackgroundOnChange = (source: string): void =>
    backgroundOnChange({
      source,
      type: WALLPAPER_TYPE.PATTERN,
      gradient: null,
      customWallpaper: null,
    })
  const backgroundGradientOnChange = (gradient: TGradientRecipe): void =>
    backgroundOnChange({
      source: gradient.preset,
      type: WALLPAPER_TYPE.GRADIENT,
      gradient,
      customWallpaper: null,
    })
  const backgroundGradientRendererOnChange = (renderer: TGradientRenderer): void => {
    const gradient =
      activeBackground.gradient ?? buildCoverGradientRecipe(activeBackground.source || 'pink')

    backgroundGradientOnChange(buildGradientRecipeForRenderer(gradient, renderer))
  }
  const backgroundGradientAngleOnChange = (angle: number): void => {
    const gradient = activeBackground.gradient
    if (!gradient) return

    if (gradient.renderer === GRADIENT_RENDERER.LINEAR || isMeshGradientRecipe(gradient)) {
      backgroundGradientOnChange({ ...gradient, angle })
    }
  }
  const toggleBackgroundTexture = (hasTexture: boolean): void => {
    const texture =
      hasTexture && activeBackground.texture.intensity === 0
        ? { ...activeBackground.texture, intensity: DEFAULT_WALLPAPER_TEXTURE_INTENSITY }
        : activeBackground.texture

    backgroundOnChange({ hasTexture, texture })
  }
  const backgroundTextureOnChange = (texture: TWallpaperTexture): void =>
    backgroundOnChange({ hasTexture: true, texture })
  const sizeOnChange = (size: TImageSize): void => snap.commit({ size })
  const rotateOnChange = (rotate: number): void => snap.commit({ rotate })

  const glassBorderOnChange = (hasGlassBorder: boolean) => snap.commit({ hasGlassBorder })

  const magnifierRadiationOnChange = (
    magnifierCenter: TCoverPoint,
    magnifierRadius: number,
  ): void => snap.commit({ magnifierCenter, magnifierRadius, hasMagnifier: true })
  const magnifierZoomOnChange = (magnifierZoom: number): void => snap.commit({ magnifierZoom })
  const magnifierAppearanceOnChange = (magnifierAppearance: Partial<TMagnifierAppearance>): void =>
    snap.commit({
      hasMagnifier: true,
      magnifierAppearance: { ...snap.magnifierAppearance, ...magnifierAppearance },
    })
  const magnifierOnChange = (hasMagnifier: boolean): void => snap.commit({ hasMagnifier })

  return {
    ...pick(keys(snap), snap),
    background: snap.background as TStore['background'],
    originalBackground: snap.originalBackground as TStore['originalBackground'],
    tuningSetting,
    imageLoadedOnChange,
    positionOnChange,
    shadowOnChange,
    borderRadiusOnChange,
    borderHighlightOnChange,
    backgroundOnChange,
    rollbackBackground,
    gradientBackgroundOnChange,
    pictureBackgroundOnChange,
    backgroundGradientOnChange,
    backgroundGradientRendererOnChange,
    backgroundGradientAngleOnChange,
    toggleBackgroundTexture,
    backgroundTextureOnChange,
    sizeOnChange,
    rotateOnChange,
    glassBorderOnChange,
    magnifierRadiationOnChange,
    magnifierZoomOnChange,
    magnifierAppearanceOnChange,
    magnifierOnChange,
  }
}
