import type { CSSProperties } from 'react'

import { normalizeSignedAngle } from '~/lib/angle'

import { GLASS_FRAME } from '../constant'
import {
  getCoverImageVarValue,
  getFrameBorderRadiusValue,
  getFramePaddingValue,
} from '../coverImageCssVars'
import { getImageShadow } from '../helper'
import type { TCoverCanvas, TCoverImageConfig } from '../spec'
import useSalon from './salon'

type TRet = {
  borderRadiusValue: string
  cropViewportStyle: CSSProperties
  editorFrameStyle: CSSProperties
  frameBorderRadiusValue: string
  framePadding?: { x: number; y: number }
  imageFrameStyle: CSSProperties
  imageStyle: CSSProperties
  magnifierImageFrameStyle: CSSProperties
}

/**
 * Derives the synchronized CSS model used by the visible image, editor overlay, and magnifier clone.
 * Keeping these styles together prevents the interaction overlay from drifting from the rendered
 * frame when size, rotation, crop, glass padding, or preview CSS variables change.
 */
const useImageRenderState = (renderCanvas: TCoverCanvas): ((image: TCoverImageConfig) => TRet) => {
  const s = useSalon()

  return (image) => {
    const imageFrameSize = s.getResponsiveImageSize(image.size, renderCanvas)
    const rotate = normalizeSignedAngle(image.rotate)
    const imagePlacement = s.getImagePlacement(image.position, image.size, rotate, renderCanvas)
    const borderRadiusValue = `${image.borderRadius}px`
    const cropPositionValue = `${image.crop.x * 100}% ${image.crop.y * 100}%`
    const frameBorderRadiusValue = getFrameBorderRadiusValue(image)
    const framePadding = image.glassBorder.enabled
      ? { x: GLASS_FRAME.PADDING_X, y: GLASS_FRAME.PADDING_Y }
      : undefined
    const imageVar = (key: string, fallback: string | number): string =>
      getCoverImageVarValue(image.which, key, fallback)
    const framePaddingValue = getFramePaddingValue(image)
    const imageFrameStyle: CSSProperties = {
      borderRadius: imageVar('frame-radius', frameBorderRadiusValue),
      width: imageVar('width', imageFrameSize.width),
      height: imageVar('height', imageFrameSize.height),
      left: imageVar('left', imagePlacement.left),
      top: imageVar('top', imagePlacement.top),
      padding: imageVar('padding', framePaddingValue),
      boxSizing: 'content-box',
      backgroundColor: image.glassBorder.enabled ? 'rgba(255, 255, 255, 0.2)' : undefined,
      backdropFilter: image.glassBorder.enabled ? 'blur(5px)' : undefined,
      WebkitBackdropFilter: image.glassBorder.enabled ? 'blur(5px)' : undefined,
      boxShadow: imageVar('shadow', getImageShadow(image.shadow) ?? 'none'),
      transform: `translate(-50%, -50%) rotate(${imageVar('rotate', `${rotate}deg`)})`,
      zIndex: imageVar('z-index', image.zIndex),
    }
    const magnifierImageFrameStyle: CSSProperties = {
      ...imageFrameStyle,
      backgroundColor: image.glassBorder.enabled ? 'rgba(255, 255, 255, 0.16)' : undefined,
      backdropFilter: undefined,
      WebkitBackdropFilter: undefined,
    }
    const editorFrameStyle: CSSProperties = {
      borderRadius: imageVar('frame-radius', frameBorderRadiusValue),
      width: imageVar('width', imageFrameSize.width),
      height: imageVar('height', imageFrameSize.height),
      left: imageVar('left', imagePlacement.left),
      top: imageVar('top', imagePlacement.top),
      padding: imageVar('padding', framePaddingValue),
      boxSizing: 'content-box',
      transform: `translate(-50%, -50%) rotate(${imageVar('rotate', `${rotate}deg`)})`,
      zIndex: imageVar('editor-z-index', image.zIndex + 1),
    }
    const cropViewportStyle: CSSProperties = {
      boxSizing: 'border-box',
      borderRadius: imageVar('crop-radius', borderRadiusValue),
    }
    const imageStyle: CSSProperties = {
      objectPosition: imageVar('crop-object-position', cropPositionValue),
      transform: imageVar('crop-transform', `scale(${image.crop.zoom})`),
      transformOrigin: imageVar('crop-transform-origin', cropPositionValue),
    }

    return {
      borderRadiusValue,
      cropViewportStyle,
      editorFrameStyle,
      frameBorderRadiusValue,
      framePadding,
      imageFrameStyle,
      imageStyle,
      magnifierImageFrameStyle,
    }
  }
}

export default useImageRenderState
