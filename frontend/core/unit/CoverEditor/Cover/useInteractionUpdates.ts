import type { MutableRefObject, PointerEvent, RefObject } from 'react'

import { COVER_IMAGE_CROP_ZOOM_RANGE, MAGNIFIER_ZOOM_RANGE } from '../constant'
import { getCoverImageLocalDragDelta } from '../helper'
import type { TScheduleImagePatch } from '../imageDraftContext'
import {
  getBorderRadiusFromCanvasPoint,
  getImagePositionFromCanvasPoint,
  getImageResizeFromCanvasPoint,
} from '../salon/metric'
import type { TCoverCanvas, TCoverPoint } from '../spec'
import {
  clamp01,
  clampCoverHeight,
  clampMagnifierZoom,
  getMagnifierRadiusFromCanvasPoint,
  type TInteractionState,
  type TInteractionUpdaters,
} from './interaction'

type TArgs = {
  canvasWidth: number
  coverHeightPreviewRef: MutableRefObject<number>
  renderCanvas: TCoverCanvas
  scheduleImagePatch: TScheduleImagePatch
  wrapperRef: RefObject<HTMLDivElement | null>
}

/**
 * Converts pointer coordinates into transient image patches or a cover-height preview.
 * This hook intentionally has no pointer-capture or commit behavior: the dispatcher chooses the
 * updater, while the lifecycle hook performs the final commit/flush exactly once.
 */
const useInteractionUpdates = ({
  canvasWidth,
  coverHeightPreviewRef,
  renderCanvas,
  scheduleImagePatch,
  wrapperRef,
}: TArgs): TInteractionUpdaters => {
  const updateMove = (
    state: Extract<TInteractionState, { type: 'move' }>,
    point: TCoverPoint,
  ): void => {
    const center = {
      x: state.startCenter.x + point.x - state.startPoint.x,
      y: state.startCenter.y + point.y - state.startPoint.y,
    }
    scheduleImagePatch(state.which, {
      position: getImagePositionFromCanvasPoint(
        center,
        state.startSize,
        state.rotate,
        renderCanvas,
      ),
    })
  }

  const updateResize = (
    state: Extract<TInteractionState, { type: 'resize' }>,
    point: TCoverPoint,
  ): void => {
    const next = getImageResizeFromCanvasPoint({
      handle: state.handle,
      point,
      rotate: state.rotate,
      startCenter: state.startCenter,
      startSize: state.startSize,
      canvas: renderCanvas,
    })
    scheduleImagePatch(state.which, {
      size: next.size,
      position: getImagePositionFromCanvasPoint(next.center, next.size, state.rotate, renderCanvas),
    })
  }

  const updateRadius = (
    state: Extract<TInteractionState, { type: 'radius' }>,
    point: TCoverPoint,
  ): void => {
    scheduleImagePatch(state.which, {
      borderRadius: getBorderRadiusFromCanvasPoint({
        canvas: renderCanvas,
        center: state.startCenter,
        handle: state.handle,
        localDirection: state.localDirection,
        point,
        rotate: state.rotate,
        size: state.startSize,
      }),
    })
  }

  const updateMagnifierMove = (
    state: Extract<TInteractionState, { type: 'magnifier-move' }>,
    point: TCoverPoint,
  ): void => {
    scheduleImagePatch(state.which, {
      magnifier: {
        center: {
          x: clamp01(
            state.startCenter.x + (point.x - state.startPoint.x) / renderCanvas.canvasWidth,
          ),
          y: clamp01(
            state.startCenter.y + (point.y - state.startPoint.y) / renderCanvas.canvasHeight,
          ),
        },
        radius: state.startRadius,
        enabled: true,
      },
    })
  }

  const updateMagnifierRadius = (
    state: Extract<TInteractionState, { type: 'magnifier-radius' }>,
    point: TCoverPoint,
  ): void => {
    scheduleImagePatch(state.which, {
      magnifier: {
        center: state.startCenter,
        radius: getMagnifierRadiusFromCanvasPoint(
          point,
          state.startCenter,
          state.startRadius,
          renderCanvas,
        ),
        enabled: true,
      },
    })
  }

  const updateMagnifierZoom = (
    state: Extract<TInteractionState, { type: 'magnifier-zoom' }>,
    point: TCoverPoint,
  ): void => {
    const distance = (point.x - state.startPoint.x + point.y - state.startPoint.y) / Math.SQRT2
    const range = MAGNIFIER_ZOOM_RANGE.MAX - MAGNIFIER_ZOOM_RANGE.MIN
    scheduleImagePatch(state.which, {
      magnifier: { zoom: clampMagnifierZoom(state.startZoom + (distance / 120) * range) },
    })
  }

  const updateCoverHeight = (
    state: Extract<TInteractionState, { type: 'cover-height' }>,
    event: PointerEvent<HTMLElement>,
  ): void => {
    const delta = ((event.clientY - state.startClientY) / state.startWrapperWidth) * canvasWidth
    const height = clampCoverHeight(state.startCanvasHeight + delta)
    // Avoid a React render on every pointermove; the lifecycle hook commits the final value.
    coverHeightPreviewRef.current = height
    if (wrapperRef.current) wrapperRef.current.style.aspectRatio = `${canvasWidth} / ${height}`
  }

  const updateCrop = (
    state: Extract<TInteractionState, { type: 'crop' }>,
    event: PointerEvent<HTMLElement>,
  ): void => {
    const delta = getCoverImageLocalDragDelta(
      event.clientX - state.startClientX,
      event.clientY - state.startClientY,
      state.rotate,
    )
    const zoom = Math.max(COVER_IMAGE_CROP_ZOOM_RANGE.MIN, state.startCrop.zoom)
    scheduleImagePatch(state.which, {
      crop: {
        x: clamp01(state.startCrop.x - delta.x / (state.frameWidth * zoom)),
        y: clamp01(state.startCrop.y - delta.y / (state.frameHeight * zoom)),
        zoom: state.startCrop.zoom,
      },
    })
  }

  return {
    updateCoverHeight,
    updateCrop,
    updateMagnifierMove,
    updateMagnifierRadius,
    updateMagnifierZoom,
    updateMove,
    updateRadius,
    updateResize,
  }
}

export default useInteractionUpdates
