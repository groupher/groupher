import type { TPreviewCssVars } from '~/hooks/useUpdatePreviewCssVars'
import { normalizeSignedAngle } from '~/lib/angle'

import { GLASS_FRAME, MAGNIFIER_RENDER_SIZE } from './constant'
import { COVER_IMAGE_WHICH_LIST } from './coverImageModel'
import type { TCoverImagePreviewState } from './coverImagePreview'
import { getImageShadow } from './helper'
import { getCoverRenderCanvas, getImagePlacement, getResponsiveImageSize } from './salon/metric'
import type { TCoverImageConfig, TCoverImageWhich } from './spec'

type TCoverImagePreviewCssVars = TPreviewCssVars

const COVER_IMAGE_VAR_KEYS = [
  'width',
  'height',
  'left',
  'top',
  'padding',
  'frame-radius',
  'crop-radius',
  'crop-object-position',
  'crop-transform',
  'crop-transform-origin',
  'shadow',
  'rotate',
  'z-index',
  'editor-z-index',
  'magnifier-width',
  'magnifier-left',
  'magnifier-top',
  'magnifier-z-index',
  'magnifier-clone-width',
  'magnifier-clone-height',
  'magnifier-clone-left',
  'magnifier-clone-top',
  'magnifier-clone-transform',
  'magnifier-clone-origin',
] as const

export function getCoverImageVarName(which: TCoverImageWhich, key: string): `--${string}` {
  return `--cover-image-${which}-${key}` as `--${string}`
}

const COVER_IMAGE_PREVIEW_CLEANUP_CSS_VARS = COVER_IMAGE_WHICH_LIST.reduce<TPreviewCssVars>(
  (vars, which) => {
    for (const key of COVER_IMAGE_VAR_KEYS) {
      vars[getCoverImageVarName(which, key)] = null
    }

    return vars
  },
  {},
)

export const getCoverImageVarValue = (
  which: TCoverImageWhich,
  key: string,
  fallback: string | number,
): string => `var(${getCoverImageVarName(which, key)}, ${fallback})`

export const getFramePaddingValue = (image: TCoverImageConfig): string =>
  image.glassBorder.enabled ? `${GLASS_FRAME.PADDING_Y}px ${GLASS_FRAME.PADDING_X}px` : '0'

export const getFrameBorderRadiusValue = (image: TCoverImageConfig): string =>
  image.glassBorder.enabled
    ? `${image.borderRadius + GLASS_FRAME.PADDING_Y}px`
    : `${image.borderRadius}px`

export const getMagnifierRenderSize = (radius: number): number =>
  MAGNIFIER_RENDER_SIZE.MIN +
  (MAGNIFIER_RENDER_SIZE.MAX - MAGNIFIER_RENDER_SIZE.MIN) * Math.min(1, Math.max(0, radius))

const getCoverImagePreviewCssVars = (
  image: TCoverImageConfig,
  canvas: TCoverImagePreviewState,
): TCoverImagePreviewCssVars => {
  const renderCanvas = getCoverRenderCanvas(canvas)
  const imageFrameSize = getResponsiveImageSize(image.size, renderCanvas)
  const rotate = normalizeSignedAngle(image.rotate)
  const imagePlacement = getImagePlacement(image.position, image.size, rotate, renderCanvas)
  const magnifierRenderSize = getMagnifierRenderSize(image.magnifier.radius)
  const magnifierSizePercent = (magnifierRenderSize / renderCanvas.canvasWidth) * 100
  const magnifierCanvasLeft =
    image.magnifier.center.x * renderCanvas.canvasWidth - magnifierRenderSize / 2
  const magnifierCanvasTop =
    image.magnifier.center.y * renderCanvas.canvasHeight - magnifierRenderSize / 2

  return {
    [getCoverImageVarName(image.which, 'width')]: imageFrameSize.width,
    [getCoverImageVarName(image.which, 'height')]: imageFrameSize.height,
    [getCoverImageVarName(image.which, 'left')]: imagePlacement.left,
    [getCoverImageVarName(image.which, 'top')]: imagePlacement.top,
    [getCoverImageVarName(image.which, 'padding')]: getFramePaddingValue(image),
    [getCoverImageVarName(image.which, 'frame-radius')]: getFrameBorderRadiusValue(image),
    [getCoverImageVarName(image.which, 'crop-radius')]: `${image.borderRadius}px`,
    [getCoverImageVarName(image.which, 'crop-object-position')]:
      `${image.crop.x * 100}% ${image.crop.y * 100}%`,
    [getCoverImageVarName(image.which, 'crop-transform')]: `scale(${image.crop.zoom})`,
    [getCoverImageVarName(image.which, 'crop-transform-origin')]:
      `${image.crop.x * 100}% ${image.crop.y * 100}%`,
    [getCoverImageVarName(image.which, 'shadow')]: getImageShadow(image.shadow) ?? 'none',
    [getCoverImageVarName(image.which, 'rotate')]: `${rotate}deg`,
    [getCoverImageVarName(image.which, 'z-index')]: image.zIndex,
    [getCoverImageVarName(image.which, 'editor-z-index')]: image.zIndex + 1,
    [getCoverImageVarName(image.which, 'magnifier-width')]: `${magnifierSizePercent}%`,
    [getCoverImageVarName(image.which, 'magnifier-left')]: `${image.magnifier.center.x * 100}%`,
    [getCoverImageVarName(image.which, 'magnifier-top')]: `${image.magnifier.center.y * 100}%`,
    [getCoverImageVarName(image.which, 'magnifier-z-index')]: image.zIndex + 2,
    [getCoverImageVarName(image.which, 'magnifier-clone-width')]:
      `${(renderCanvas.canvasWidth / magnifierRenderSize) * 100}%`,
    [getCoverImageVarName(image.which, 'magnifier-clone-height')]:
      `${(renderCanvas.canvasHeight / magnifierRenderSize) * 100}%`,
    [getCoverImageVarName(image.which, 'magnifier-clone-left')]:
      `${(-magnifierCanvasLeft / magnifierRenderSize) * 100}%`,
    [getCoverImageVarName(image.which, 'magnifier-clone-top')]:
      `${(-magnifierCanvasTop / magnifierRenderSize) * 100}%`,
    [getCoverImageVarName(image.which, 'magnifier-clone-transform')]:
      `scale(${image.magnifier.zoom})`,
    [getCoverImageVarName(image.which, 'magnifier-clone-origin')]:
      `${image.magnifier.center.x * 100}% ${image.magnifier.center.y * 100}%`,
  }
}

/**
 * Compose the rAF preview CSS vars for every image slot in the cover editor.
 *
 * The cleanup vars are seeded first so deleting primary/secondary removes stale
 * slot-specific CSS variables before the existing images write their live values.
 *
 * @example
 * updatePreviewCssVars(getCoverPreviewCssVars(previewState))
 */
export const getCoverPreviewCssVars = (state: TCoverImagePreviewState): TCoverImagePreviewCssVars =>
  (
    [state.images.primary, state.images.secondary].filter(Boolean) as TCoverImageConfig[]
  ).reduce<TCoverImagePreviewCssVars>(
    (vars, image) => ({
      ...vars,
      ...getCoverImagePreviewCssVars(image, state),
    }),
    { ...COVER_IMAGE_PREVIEW_CLEANUP_CSS_VARS },
  )
