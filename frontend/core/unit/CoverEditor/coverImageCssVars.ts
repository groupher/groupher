import type { TPreviewCssVars } from '~/hooks/useUpdatePreviewCssVars'
import { normalizeSignedAngle } from '~/lib/angle'

import { GLASS_FRAME, IMAGE_CONTAINER_SIZE, MAGNIFIER_RENDER_SIZE } from './constant'
import { COVER_IMAGE_WHICH_LIST } from './coverImageModel'
import type { TCoverImagePreviewState } from './coverImagePreview'
import { getImageShadow } from './helper'
import { getImagePlacement, getResponsiveImageSize } from './salon/metric'
import type { TCoverImageConfig, TCoverImageWhich } from './spec'

type TCoverImagePreviewCssVars = TPreviewCssVars

const CANVAS_WIDTH = Number.parseFloat(IMAGE_CONTAINER_SIZE.WIDTH)
const CANVAS_HEIGHT = Number.parseFloat(IMAGE_CONTAINER_SIZE.HEIGHT)

const COVER_IMAGE_VAR_KEYS = [
  'width',
  'height',
  'left',
  'top',
  'padding',
  'frame-radius',
  'crop-radius',
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

const getCoverImagePreviewCssVars = (image: TCoverImageConfig): TCoverImagePreviewCssVars => {
  const imageFrameSize = getResponsiveImageSize(image.size)
  const imagePlacement = getImagePlacement(image.position, image.size, image.rotate)
  const magnifierRenderSize = getMagnifierRenderSize(image.magnifier.radius)
  const magnifierSizePercent = (magnifierRenderSize / CANVAS_WIDTH) * 100
  const magnifierCanvasLeft = image.magnifier.center.x * CANVAS_WIDTH - magnifierRenderSize / 2
  const magnifierCanvasTop = image.magnifier.center.y * CANVAS_HEIGHT - magnifierRenderSize / 2

  return {
    [getCoverImageVarName(image.which, 'width')]: imageFrameSize.width,
    [getCoverImageVarName(image.which, 'height')]: imageFrameSize.height,
    [getCoverImageVarName(image.which, 'left')]: imagePlacement.left,
    [getCoverImageVarName(image.which, 'top')]: imagePlacement.top,
    [getCoverImageVarName(image.which, 'padding')]: getFramePaddingValue(image),
    [getCoverImageVarName(image.which, 'frame-radius')]: getFrameBorderRadiusValue(image),
    [getCoverImageVarName(image.which, 'crop-radius')]: `${image.borderRadius}px`,
    [getCoverImageVarName(image.which, 'shadow')]: getImageShadow(image.shadow) ?? 'none',
    [getCoverImageVarName(image.which, 'rotate')]: `${normalizeSignedAngle(image.rotate)}deg`,
    [getCoverImageVarName(image.which, 'z-index')]: image.zIndex,
    [getCoverImageVarName(image.which, 'editor-z-index')]: image.zIndex + 1,
    [getCoverImageVarName(image.which, 'magnifier-width')]: `${magnifierSizePercent}%`,
    [getCoverImageVarName(image.which, 'magnifier-left')]: `${image.magnifier.center.x * 100}%`,
    [getCoverImageVarName(image.which, 'magnifier-top')]: `${image.magnifier.center.y * 100}%`,
    [getCoverImageVarName(image.which, 'magnifier-z-index')]: image.zIndex + 2,
    [getCoverImageVarName(image.which, 'magnifier-clone-width')]:
      `${(CANVAS_WIDTH / magnifierRenderSize) * 100}%`,
    [getCoverImageVarName(image.which, 'magnifier-clone-height')]:
      `${(CANVAS_HEIGHT / magnifierRenderSize) * 100}%`,
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
      ...getCoverImagePreviewCssVars(image),
    }),
    { ...COVER_IMAGE_PREVIEW_CLEANUP_CSS_VARS },
  )
