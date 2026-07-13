import { useEffect } from 'react'
import type { PointerEvent, RefObject } from 'react'

import type { TCoverImageDraftContext } from '../imageDraftContext'
import { getCanvasPointFromClient, type TImageResizeHandle } from '../salon/metric'
import type { TCoverCanvas, TCoverImageConfig, TCoverPoint, TImageEditMode } from '../spec'
import { isPrimaryPointer, type TInteractionState } from './interaction'
import useImageInteractionStart from './useImageInteractionStart'
import useInteractionLifecycle from './useInteractionLifecycle'
import useInteractionUpdates from './useInteractionUpdates'
import usePointerDispatcher from './usePointerDispatcher'

type TArgs = {
  activateImageDraft: TCoverImageDraftContext['activateImageDraft']
  canvasHeight: number
  canvasWidth: number
  commitCoverHeight: (height: number) => void
  flushImageDraft: TCoverImageDraftContext['flushImageDraft']
  getImageEditMode: (which: TCoverImageConfig['which']) => TImageEditMode
  onRadiusFinish: () => void
  onRadiusStart: (handle: TImageResizeHandle) => void
  renderCanvas: TCoverCanvas
  scheduleImagePatch: TCoverImageDraftContext['scheduleImagePatch']
  wrapperRef: RefObject<HTMLDivElement | null>
}

/**
 * Public interaction boundary for the cover canvas.
 *
 * The smaller hooks below remain responsible for one technical layer each. This facade only
 * connects those layers and exposes handlers that rendering code can attach to concrete elements.
 * It deliberately does not own edit modes, hover state, image data, or render composition.
 *
 * Pointer flow:
 *
 *   pointerdown
 *      |
 *      v
 *   validate input -> derive start geometry -> activate draft -> set pointer capture
 *      |                                                   |
 *      v                                                   v
 *   write interactionRef --------------------------> set interactionMode
 *      |
 *      v
 *   pointermove -> dispatcher -> geometry updater -> schedule image patch / preview height
 *      |
 *      v
 *   pointerup/cancel -> final move -> release capture -> commit height -> flush image draft
 *
 * Pointer capture remains on the DOM element that received pointerdown. The shared ref stores
 * only the serializable interaction description needed by move/up dispatch.
 */
const useCoverInteractions = ({
  activateImageDraft,
  canvasHeight,
  canvasWidth,
  commitCoverHeight,
  flushImageDraft,
  getImageEditMode,
  onRadiusFinish,
  onRadiusStart,
  renderCanvas,
  scheduleImagePatch,
  wrapperRef,
}: TArgs) => {
  const {
    coverHeightPreviewRef,
    finishInteraction,
    interactionMode,
    interactionRef,
    setInteractionMode,
  } = useInteractionLifecycle({
    commitCoverHeight,
    flushImageDraft,
    initialCoverHeight: canvasHeight,
  })

  useEffect(() => {
    coverHeightPreviewRef.current = canvasHeight
  }, [canvasHeight, coverHeightPreviewRef])

  const getCanvasPoint = (event: PointerEvent<HTMLElement>): TCoverPoint | null => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return null
    return getCanvasPointFromClient(event.clientX, event.clientY, rect, renderCanvas)
  }

  const updaters = useInteractionUpdates({
    canvasWidth,
    coverHeightPreviewRef,
    renderCanvas,
    scheduleImagePatch,
    wrapperRef,
  })
  const pointer = usePointerDispatcher({
    finishInteraction,
    getCanvasPoint,
    interactionRef,
    onRadiusFinish,
    updaters,
  })
  const image = useImageInteractionStart({
    activateImageDraft,
    getCanvasPoint,
    getImageEditMode,
    interactionRef,
    onRadiusStart,
    renderCanvas,
    setInteractionMode,
    updateRadius: updaters.updateRadius,
  })

  const startCoverHeight = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!isPrimaryPointer(event)) return
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    interactionRef.current = {
      pointerId: event.pointerId,
      startCanvasHeight: canvasHeight,
      startClientY: event.clientY,
      startWrapperWidth: rect.width,
      type: 'cover-height',
    }
    coverHeightPreviewRef.current = canvasHeight
    setInteractionMode('cover-height')
  }

  const startMagnifierMove =
    (coverImage: TCoverImageConfig) =>
    (event: PointerEvent<HTMLDivElement>): void => {
      if (!isPrimaryPointer(event)) return
      const point = getCanvasPoint(event)
      if (!point) return

      event.preventDefault()
      event.stopPropagation()
      activateImageDraft(coverImage.which)
      event.currentTarget.setPointerCapture(event.pointerId)
      interactionRef.current = {
        pointerId: event.pointerId,
        startCenter: coverImage.magnifier.center,
        startPoint: point,
        startRadius: coverImage.magnifier.radius,
        type: 'magnifier-move',
        which: coverImage.which,
      }
      setInteractionMode('magnifier-move')
    }

  const startMagnifierRadius =
    (coverImage: TCoverImageConfig) =>
    (event: PointerEvent<HTMLButtonElement>): void => {
      if (!isPrimaryPointer(event)) return
      const point = getCanvasPoint(event)
      if (!point) return

      event.preventDefault()
      event.stopPropagation()
      activateImageDraft(coverImage.which)
      event.currentTarget.setPointerCapture(event.pointerId)
      const state: Extract<TInteractionState, { type: 'magnifier-radius' }> = {
        pointerId: event.pointerId,
        startCenter: coverImage.magnifier.center,
        startRadius: coverImage.magnifier.radius,
        type: 'magnifier-radius',
        which: coverImage.which,
      }
      interactionRef.current = state
      setInteractionMode('magnifier-radius')
      updaters.updateMagnifierRadius(state, point)
    }

  const startMagnifierZoom =
    (coverImage: TCoverImageConfig) =>
    (event: PointerEvent<HTMLButtonElement>): void => {
      if (!isPrimaryPointer(event)) return
      const point = getCanvasPoint(event)
      if (!point) return

      event.preventDefault()
      event.stopPropagation()
      activateImageDraft(coverImage.which)
      event.currentTarget.setPointerCapture(event.pointerId)
      interactionRef.current = {
        pointerId: event.pointerId,
        startPoint: point,
        startZoom: coverImage.magnifier.zoom,
        type: 'magnifier-zoom',
        which: coverImage.which,
      }
      setInteractionMode('magnifier-zoom')
    }

  return {
    coverHeight: { onPointerDown: startCoverHeight },
    image: {
      onPointerDown: image.handleImagePointerDown,
      onRadiusPointerDown: image.handleRadiusPointerDown,
      onResizePointerDown: image.handleResizePointerDown,
    },
    magnifier: {
      onMovePointerDown: startMagnifierMove,
      onRadiusPointerDown: startMagnifierRadius,
      onZoomPointerDown: startMagnifierZoom,
    },
    mode: interactionMode,
    pointer: {
      onMove: pointer.handlePointerMove,
      onUp: pointer.handlePointerUp,
    },
    stateRef: interactionRef,
  }
}

export default useCoverInteractions
