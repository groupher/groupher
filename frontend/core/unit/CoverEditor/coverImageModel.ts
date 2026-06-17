import {
  BORDER_HIGHLIGHT_DEFAULT,
  COVER_IMAGE_WHICH,
  COVER_IMAGE_Z_INDEX,
  COVER_SHADOW_DEFAULT,
  COVER_SHADOW_PRESET,
  MAGNIFIER_APPEARANCE_DEFAULT,
  MAGNIFIER_RADIUS_DEFAULT,
  MAGNIFIER_ZOOM_DEFAULT,
} from './constant'
import type {
  TBorderHighlight,
  TCoverImageCrop,
  TCoverImageConfig,
  TCoverImages,
  TCoverImageWhich,
  TCoverMagnifier,
  TCoverShadow,
} from './spec'

/**
 * Canonical image-slot model for the cover editor.
 *
 * Both the committed valtio store and the transient preview draft use these
 * helpers, so primary/secondary defaults, active-image fallback, and z-index
 * raising stay identical across React state commits and rAF preview updates.
 *
 * @example
 * const image = createCoverImageConfig(COVER_IMAGE_WHICH.SECONDARY, localUrl)
 * const raised = getRaisedImages({ ...images, secondary: image }, COVER_IMAGE_WHICH.SECONDARY)
 */
export const COVER_IMAGE_WHICH_LIST = [
  COVER_IMAGE_WHICH.PRIMARY,
  COVER_IMAGE_WHICH.SECONDARY,
] as const

export const EMPTY_COVER_IMAGES: TCoverImages = {
  [COVER_IMAGE_WHICH.PRIMARY]: null,
  [COVER_IMAGE_WHICH.SECONDARY]: null,
}

const createDefaultShadow = (): TCoverShadow => ({
  preset: COVER_SHADOW_DEFAULT.PRESET,
  colorMode: COVER_SHADOW_DEFAULT.COLOR_MODE,
  hue: COVER_SHADOW_DEFAULT.HUE,
  rainbowHue: COVER_SHADOW_DEFAULT.RAINBOW_HUE,
  x: COVER_SHADOW_DEFAULT.X,
  y: COVER_SHADOW_DEFAULT.Y,
  blur: COVER_SHADOW_DEFAULT.BLUR,
  spread: COVER_SHADOW_DEFAULT.SPREAD,
  opacity: COVER_SHADOW_DEFAULT.OPACITY,
})

const createDefaultBorderHighlight = (): TBorderHighlight => ({
  enabled: BORDER_HIGHLIGHT_DEFAULT.ENABLED,
  mode: BORDER_HIGHLIGHT_DEFAULT.MODE,
  angle: BORDER_HIGHLIGHT_DEFAULT.ANGLE,
  length: BORDER_HIGHLIGHT_DEFAULT.LENGTH,
  hue: BORDER_HIGHLIGHT_DEFAULT.HUE,
  rainbowHue: BORDER_HIGHLIGHT_DEFAULT.RAINBOW_HUE,
  saturation: BORDER_HIGHLIGHT_DEFAULT.SATURATION,
  lightness: BORDER_HIGHLIGHT_DEFAULT.LIGHTNESS,
  opacity: BORDER_HIGHLIGHT_DEFAULT.OPACITY,
})

const createDefaultMagnifier = (): TCoverMagnifier => ({
  enabled: false,
  center: { x: 0.5, y: 0.5 },
  radius: MAGNIFIER_RADIUS_DEFAULT,
  zoom: MAGNIFIER_ZOOM_DEFAULT,
  borderColor: MAGNIFIER_APPEARANCE_DEFAULT.BORDER_COLOR,
  borderWidth: MAGNIFIER_APPEARANCE_DEFAULT.BORDER_WIDTH,
  highlightCenter: { ...MAGNIFIER_APPEARANCE_DEFAULT.HIGHLIGHT_CENTER },
  highlightIntensity: MAGNIFIER_APPEARANCE_DEFAULT.HIGHLIGHT_INTENSITY,
  shadow: MAGNIFIER_APPEARANCE_DEFAULT.SHADOW,
})

const createDefaultCrop = (): TCoverImageCrop => ({
  x: 0.5,
  y: 0.5,
  zoom: 1,
})

export const createCoverImageConfig = (
  which: TCoverImageWhich,
  source: string,
): TCoverImageConfig => {
  const isSecondary = which === COVER_IMAGE_WHICH.SECONDARY

  return {
    which,
    zIndex: isSecondary ? COVER_IMAGE_Z_INDEX.TOP : COVER_IMAGE_Z_INDEX.BASE,
    source,
    dominantColor: null,
    size: isSecondary ? 62 : 94,
    rotate: 0,
    position: isSecondary ? { x: 0.58, y: 0.38 } : { x: 0.5, y: 0.5 },
    crop: createDefaultCrop(),
    shadow: {
      ...createDefaultShadow(),
      preset: isSecondary ? COVER_SHADOW_PRESET.LARGE : COVER_SHADOW_DEFAULT.PRESET,
    },
    borderRadius: 0,
    borderHighlight: createDefaultBorderHighlight(),
    glassBorder: { enabled: false },
    magnifier: createDefaultMagnifier(),
  }
}

export const getRaisedImages = (images: TCoverImages, which: TCoverImageWhich): TCoverImages => ({
  [COVER_IMAGE_WHICH.PRIMARY]: images.primary
    ? {
        ...images.primary,
        zIndex:
          which === COVER_IMAGE_WHICH.PRIMARY ? COVER_IMAGE_Z_INDEX.TOP : COVER_IMAGE_Z_INDEX.BASE,
      }
    : null,
  [COVER_IMAGE_WHICH.SECONDARY]: images.secondary
    ? {
        ...images.secondary,
        zIndex:
          which === COVER_IMAGE_WHICH.SECONDARY
            ? COVER_IMAGE_Z_INDEX.TOP
            : COVER_IMAGE_Z_INDEX.BASE,
      }
    : null,
})

export const getActiveImage = (
  images: TCoverImages,
  activeImageWhich: TCoverImageWhich,
): TCoverImageConfig | null => images[activeImageWhich] ?? images.primary ?? images.secondary

export const getNextActiveImageWhich = (
  images: TCoverImages,
  activeImageWhich: TCoverImageWhich,
): TCoverImageWhich => {
  if (images[activeImageWhich]) return activeImageWhich
  if (images.primary) return COVER_IMAGE_WHICH.PRIMARY
  if (images.secondary) return COVER_IMAGE_WHICH.SECONDARY

  // Keep the selected slot stable when both image slots are empty.
  return activeImageWhich
}
