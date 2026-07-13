import type { PointerEvent, RefObject } from 'react'

import { normalizeSignedAngle } from '~/lib/angle'

import { IMAGE_EDIT_MODE } from '../constant'
import { getImageCanvasCenter, type TImageResizeHandle } from '../salon/metric'
import type { TCoverCanvas, TCoverImageConfig, TCoverPoint, TImageEditMode } from '../spec'
import { isPrimaryPointer, type TInteractionMode, type TInteractionState } from './interaction'

type TArgs = {
  activateImageDraft: (which: TCoverImageConfig['which']) => void
  getCanvasPoint: (event: PointerEvent<HTMLElement>) => TCoverPoint | null
  getImageEditMode: (which: TCoverImageConfig['which']) => TImageEditMode
  interactionRef: RefObject<TInteractionState | null>
  onRadiusStart: (handle: TImageResizeHandle) => void
  renderCanvas: TCoverCanvas
  setInteractionMode: (mode: TInteractionMode) => void
  updateRadius: (state: Extract<TInteractionState, { type: 'radius' }>, point: TCoverPoint) => void
}

/**
 * Starts interactions owned by an image frame. Pointer capture stays on the concrete frame or
 * handle that received pointerdown; only the shared interaction description is stored here.
 */
const useImageInteractionStart = ({
  activateImageDraft,
  getCanvasPoint,
  getImageEditMode,
  interactionRef,
  onRadiusStart,
  renderCanvas,
  setInteractionMode,
  updateRadius,
}: TArgs) => {
  const startMove =
    (image: TCoverImageConfig) =>
    (event: PointerEvent<HTMLDivElement>): void => {
      if (!isPrimaryPointer(event)) return
      const startPoint = getCanvasPoint(event)
      if (!startPoint) return

      event.preventDefault()
      activateImageDraft(image.which)
      event.currentTarget.setPointerCapture(event.pointerId)
      const rotate = normalizeSignedAngle(image.rotate)
      interactionRef.current = {
        pointerId: event.pointerId,
        rotate,
        startCenter: getImageCanvasCenter(image.position, image.size, rotate, renderCanvas),
        startPoint,
        startSize: image.size,
        type: 'move',
        which: image.which,
      }
      setInteractionMode('move')
    }

  const startCrop =
    (image: TCoverImageConfig) =>
    (event: PointerEvent<HTMLDivElement>): void => {
      if (!isPrimaryPointer(event)) return
      const rect = event.currentTarget.getBoundingClientRect()
      if (!rect.width || !rect.height) return

      event.preventDefault()
      activateImageDraft(image.which)
      event.currentTarget.setPointerCapture(event.pointerId)
      interactionRef.current = {
        frameHeight: rect.height,
        frameWidth: rect.width,
        pointerId: event.pointerId,
        rotate: normalizeSignedAngle(image.rotate),
        startClientX: event.clientX,
        startClientY: event.clientY,
        startCrop: image.crop,
        type: 'crop',
        which: image.which,
      }
      setInteractionMode('crop')
    }

  const handleImagePointerDown =
    (image: TCoverImageConfig) =>
    (event: PointerEvent<HTMLDivElement>): void => {
      if (getImageEditMode(image.which) === IMAGE_EDIT_MODE.REPOSITION) startCrop(image)(event)
      else startMove(image)(event)
    }

  const handleResizePointerDown =
    (image: TCoverImageConfig, handle: TImageResizeHandle) =>
    (event: PointerEvent<HTMLElement>): void => {
      if (!isPrimaryPointer(event)) return
      event.preventDefault()
      event.stopPropagation()
      activateImageDraft(image.which)
      event.currentTarget.setPointerCapture(event.pointerId)
      const rotate = normalizeSignedAngle(image.rotate)
      interactionRef.current = {
        handle,
        pointerId: event.pointerId,
        rotate,
        startCenter: getImageCanvasCenter(image.position, image.size, rotate, renderCanvas),
        startSize: image.size,
        type: 'resize',
        which: image.which,
      }
      setInteractionMode('resize')
    }

  const handleRadiusPointerDown =
    (image: TCoverImageConfig, handle: TImageResizeHandle, localDirection: TCoverPoint) =>
    (event: PointerEvent<HTMLButtonElement>): void => {
      if (!isPrimaryPointer(event)) return
      const point = getCanvasPoint(event)
      if (!point) return

      event.preventDefault()
      event.stopPropagation()
      activateImageDraft(image.which)
      event.currentTarget.setPointerCapture(event.pointerId)
      const rotate = normalizeSignedAngle(image.rotate)
      const state: Extract<TInteractionState, { type: 'radius' }> = {
        handle,
        localDirection,
        pointerId: event.pointerId,
        rotate,
        startCenter: getImageCanvasCenter(image.position, image.size, rotate, renderCanvas),
        startSize: image.size,
        type: 'radius',
        which: image.which,
      }
      interactionRef.current = state
      onRadiusStart(handle)
      setInteractionMode('radius')
      updateRadius(state, point)
    }

  return { handleImagePointerDown, handleRadiusPointerDown, handleResizePointerDown }
}

export default useImageInteractionStart
