import { clone, equals, keys, mergeDeepRight, pick } from 'ramda'
import { proxy, useSnapshot } from 'valtio'

import { WALLPAPER_TYPE } from '~/const/wallpaper'
import useTheme from '~/hooks/useTheme'
import { normalizeSignedAngle } from '~/lib/angle'
import type { TBgConfig, TBgTexture } from '~/lib/bg'
import {
  DEFAULT_WALLPAPER_TEXTURE_INTENSITY,
  GRADIENT_RENDERER,
  composeGradientRecipeForRenderer,
  isMeshGradientRecipe,
  type TGradientRecipe,
  type TGradientRenderer,
} from '~/lib/wallpaperMesh'

import { composeCoverGradientRecipe, createCoverBgThemeConfig } from './background'
import { COVER_CANVAS_SIZE, COVER_HEIGHT_RANGE, COVER_IMAGE_WHICH } from './constant'
import {
  createCoverImageConfig,
  EMPTY_COVER_IMAGES,
  getActiveImage,
  getNextActiveImageWhich,
  getRaisedImages,
} from './coverImageModel'
import type {
  TBorderHighlight,
  TCoverBackgroundPatch,
  TCoverConfig,
  TCoverImageConfig,
  TCoverImagePatch,
  TCoverImages,
  TCoverImageWhich,
  TCoverMagnifier,
  TCoverPoint,
  TCoverShadow,
  TImageSize,
  TStore,
  TTuningSetting,
} from './spec'

type TRet = {
  coverConfig: TCoverConfig
  imageSourceOnChange: (which: TCoverImageWhich, imageUrl: string) => void
  imageLoadedOnChange: (
    which: TCoverImageWhich,
    imageUrl: string,
    imageDominantColor: string | null,
  ) => void
  imagesOnChange: (nextImages: TCoverImages, nextActiveImageWhich?: TCoverImageWhich) => void
  imagePatchOnChange: (
    which: TCoverImageWhich,
    patch: TCoverImagePatch,
    options?: { raise?: boolean },
  ) => void
  imageDeleteOnChange: (which: TCoverImageWhich) => void
  imageActivateOnChange: (which: TCoverImageWhich) => void
  resetImages: () => void
  positionOnChange: (which: TCoverImageWhich, position: TCoverPoint) => void
  shadowOnChange: (which: TCoverImageWhich, shadow: Partial<TCoverShadow>) => void
  borderRadiusOnChange: (which: TCoverImageWhich, borderRadius: number) => void
  borderHighlightOnChange: (
    which: TCoverImageWhich,
    borderHighlight: Partial<TBorderHighlight>,
  ) => void
  backgroundOnChange: (patch: TCoverBackgroundPatch) => void
  rollbackBackground: () => void
  gradientBackgroundOnChange: (source: string) => void
  pictureBackgroundOnChange: (source: string) => void
  backgroundGradientOnChange: (gradient: TGradientRecipe) => void
  backgroundGradientRendererOnChange: (renderer: TGradientRenderer) => void
  backgroundGradientAngleOnChange: (angle: number) => void
  toggleBackgroundTexture: (enabled: boolean) => void
  backgroundTextureOnChange: (texture: TBgTexture) => void
  sizeOnChange: (which: TCoverImageWhich, size: TImageSize) => void
  rotateOnChange: (which: TCoverImageWhich, rotate: number) => void
  canvasHeightOnChange: (canvasHeight: number) => void
  glassBorderOnChange: (which: TCoverImageWhich, enabled: boolean) => void
  magnifierSettingsOnChange: (which: TCoverImageWhich, magnifier: Partial<TCoverMagnifier>) => void
  magnifierOnChange: (which: TCoverImageWhich, enabled: boolean) => void
} & TStore

const store = proxy<TStore>({
  images: clone(EMPTY_COVER_IMAGES),
  activeImageWhich: COVER_IMAGE_WHICH.PRIMARY,
  canvasWidth: COVER_CANVAS_SIZE.WIDTH,
  canvasHeight: COVER_CANVAS_SIZE.HEIGHT,

  // for background
  background: createCoverBgThemeConfig(),
  originalBackground: createCoverBgThemeConfig(),

  get tuningSetting(): TTuningSetting {
    const { images, activeImageWhich, background, originalBackground, canvasWidth, canvasHeight } =
      store

    return {
      images,
      activeImageWhich,
      activeImage: getActiveImage(images, activeImageWhich),
      canvasWidth,
      canvasHeight,
      background,
      activeBackground: background.light,
      isBackgroundTouched: !equals(clone(originalBackground), clone(background)),
    }
  },

  commit: (patch: Partial<TStore>): void => {
    Object.assign(store, patch)
  },
})

export default function useLogic(): TRet {
  const snap = useSnapshot(store)
  const { isDarkTheme } = useTheme()
  const activeThemeKey = isDarkTheme ? 'dark' : 'light'
  const activeBackground = snap.background[activeThemeKey] as TBgConfig
  const images = snap.images as TCoverImages
  const activeImageWhich = getNextActiveImageWhich(images, snap.activeImageWhich)
  const tuningSetting = {
    ...snap.tuningSetting,
    images,
    activeImageWhich,
    activeImage: getActiveImage(images, activeImageWhich),
    canvasWidth: snap.canvasWidth,
    canvasHeight: snap.canvasHeight,
    activeBackground,
    isBackgroundTouched: !equals(clone(snap.originalBackground), clone(snap.background)),
  } as TTuningSetting
  const coverConfig: TCoverConfig = {
    canvasWidth: snap.canvasWidth,
    canvasHeight: snap.canvasHeight,
    images,
    background: snap.background as TStore['background'],
  }

  const commitImages = (
    nextImages: TCoverImages,
    nextActiveImageWhich = activeImageWhich,
  ): void => {
    const resolvedActiveImageWhich = getNextActiveImageWhich(nextImages, nextActiveImageWhich)
    if (activeImageWhich === resolvedActiveImageWhich && equals(images, nextImages)) return

    snap.commit({
      images: nextImages,
      activeImageWhich: resolvedActiveImageWhich,
    })
  }

  const imagesOnChange = (
    nextImages: TCoverImages,
    nextActiveImageWhich = activeImageWhich,
  ): void => {
    commitImages(nextImages, nextActiveImageWhich)
  }

  const imagePatchOnChange = (
    which: TCoverImageWhich,
    patch: TCoverImagePatch,
    options: { raise?: boolean } = {},
  ): void => {
    const image = images[which]
    if (!image) return

    const nextImage = mergeDeepRight(image, patch) as TCoverImageConfig
    if (equals(image, nextImage)) return

    const nextImages = {
      ...images,
      [which]: nextImage,
    }

    commitImages(
      options.raise === false ? nextImages : getRaisedImages(nextImages, which),
      options.raise === false ? activeImageWhich : which,
    )
  }

  const imageSourceOnChange = (which: TCoverImageWhich, imageUrl: string): void => {
    if (!imageUrl) return

    const currentImage = images[which]
    const nextImage = currentImage
      ? {
          ...currentImage,
          source: imageUrl,
          dominantColor: currentImage.source === imageUrl ? currentImage.dominantColor : null,
        }
      : createCoverImageConfig(which, imageUrl)

    commitImages(getRaisedImages({ ...images, [which]: nextImage }, which), which)
  }

  const imageLoadedOnChange = (
    which: TCoverImageWhich,
    imageUrl: string,
    imageDominantColor: string | null,
  ): void => {
    const image = images[which]
    if (!image || image.source !== imageUrl || image.dominantColor === imageDominantColor) return

    imagePatchOnChange(which, { dominantColor: imageDominantColor }, { raise: false })
  }

  const imageDeleteOnChange = (which: TCoverImageWhich): void => {
    commitImages(
      { ...images, [which]: null },
      activeImageWhich === which ? which : activeImageWhich,
    )
  }

  const imageActivateOnChange = (which: TCoverImageWhich): void => {
    if (!images[which]) return

    const nextImages = getRaisedImages(images, which)
    if (activeImageWhich === which && equals(images, nextImages)) return

    commitImages(nextImages, which)
  }

  const resetImages = (): void => {
    commitImages(clone(EMPTY_COVER_IMAGES), COVER_IMAGE_WHICH.PRIMARY)
  }

  const positionOnChange = (which: TCoverImageWhich, position: TCoverPoint): void =>
    imagePatchOnChange(which, { position })
  const shadowOnChange = (which: TCoverImageWhich, shadow: Partial<TCoverShadow>): void => {
    const image = images[which]
    if (!image) return

    imagePatchOnChange(which, { shadow: { ...image.shadow, ...shadow } })
  }
  const borderRadiusOnChange = (which: TCoverImageWhich, borderRadius: number): void =>
    imagePatchOnChange(which, { borderRadius })
  const borderHighlightOnChange = (
    which: TCoverImageWhich,
    borderHighlight: Partial<TBorderHighlight>,
  ): void => {
    const image = images[which]
    if (!image) return

    imagePatchOnChange(which, { borderHighlight: { ...image.borderHighlight, ...borderHighlight } })
  }
  const backgroundOnChange = (patch: TCoverBackgroundPatch): void =>
    snap.commit({
      background: {
        ...snap.background,
        [activeThemeKey]: mergeDeepRight(activeBackground, patch),
      } as TStore['background'],
    })
  const rollbackBackground = (): void =>
    snap.commit({ background: clone(snap.originalBackground) as TStore['background'] })
  const gradientBackgroundOnChange = (source: string): void => {
    const renderer = activeBackground.gradient?.renderer ?? GRADIENT_RENDERER.LINEAR

    backgroundOnChange({
      source,
      type: WALLPAPER_TYPE.GRADIENT,
      gradient: composeCoverGradientRecipe(source, renderer),
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
      activeBackground.gradient ?? composeCoverGradientRecipe(activeBackground.source || 'pink')

    backgroundGradientOnChange(composeGradientRecipeForRenderer(gradient, renderer))
  }
  const backgroundGradientAngleOnChange = (angle: number): void => {
    const gradient = activeBackground.gradient
    if (!gradient) return
    const nextAngle = normalizeSignedAngle(angle)

    if (gradient.renderer === GRADIENT_RENDERER.LINEAR || isMeshGradientRecipe(gradient)) {
      backgroundGradientOnChange({ ...gradient, angle: nextAngle })
    }
  }
  const toggleBackgroundTexture = (enabled: boolean): void => {
    const texture =
      enabled && activeBackground.texture.intensity === 0
        ? { ...activeBackground.texture, intensity: DEFAULT_WALLPAPER_TEXTURE_INTENSITY }
        : activeBackground.texture

    backgroundOnChange({ texture: { ...texture, enabled } })
  }
  const backgroundTextureOnChange = (texture: TBgTexture): void =>
    backgroundOnChange({ texture: { ...texture, enabled: true } })
  const sizeOnChange = (which: TCoverImageWhich, size: TImageSize): void =>
    imagePatchOnChange(which, { size })
  const rotateOnChange = (which: TCoverImageWhich, rotate: number): void =>
    imagePatchOnChange(which, { rotate: normalizeSignedAngle(rotate) })

  const canvasHeightOnChange = (canvasHeight: number): void => {
    const nextCanvasHeight = Math.min(
      COVER_HEIGHT_RANGE.MAX,
      Math.max(COVER_HEIGHT_RANGE.MIN, Math.round(canvasHeight)),
    )
    if (nextCanvasHeight === snap.canvasHeight) return

    snap.commit({ canvasHeight: nextCanvasHeight })
  }

  const glassBorderOnChange = (which: TCoverImageWhich, enabled: boolean) =>
    imagePatchOnChange(which, { glassBorder: { enabled } })

  const magnifierSettingsOnChange = (
    which: TCoverImageWhich,
    magnifier: Partial<TCoverMagnifier>,
  ): void => {
    const image = images[which]
    if (!image) return

    imagePatchOnChange(which, {
      magnifier: { ...image.magnifier, ...magnifier, enabled: true },
    })
  }
  const magnifierOnChange = (which: TCoverImageWhich, enabled: boolean): void =>
    imagePatchOnChange(which, { magnifier: { enabled } })

  return {
    ...pick(keys(snap), snap),
    images,
    activeImageWhich,
    background: snap.background as TStore['background'],
    originalBackground: snap.originalBackground as TStore['originalBackground'],
    tuningSetting,
    coverConfig,
    imageSourceOnChange,
    imageLoadedOnChange,
    imagesOnChange,
    imagePatchOnChange,
    imageDeleteOnChange,
    imageActivateOnChange,
    resetImages,
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
    canvasHeightOnChange,
    glassBorderOnChange,
    magnifierSettingsOnChange,
    magnifierOnChange,
  }
}
