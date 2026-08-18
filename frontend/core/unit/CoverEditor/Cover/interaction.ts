import type { PointerEvent } from 'react'

import { COVER_HEIGHT_RANGE, MAGNIFIER_RENDER_SIZE, MAGNIFIER_ZOOM_RANGE } from '../constant'
import type { TImageResizeHandle } from '../salon/metric'
import type { TCoverImageCrop, TCoverImageWhich, TCoverPoint, TImageSize } from '../spec'

export type TInteractionMode =
  | 'idle'
  | 'magnifier-move'
  | 'magnifier-radius'
  | 'magnifier-zoom'
  | 'move'
  | 'radius'
  | 'resize'
  | 'cover-height'
  | 'crop'

export type TInteractionState =
  | {
      pointerId: number
      rotate: number
      startCenter: TCoverPoint
      startPoint: TCoverPoint
      startSize: TImageSize
      type: 'move'
      which: TCoverImageWhich
    }
  | {
      handle: TImageResizeHandle
      pointerId: number
      rotate: number
      startCenter: TCoverPoint
      startSize: TImageSize
      type: 'resize'
      which: TCoverImageWhich
    }
  | {
      handle: TImageResizeHandle
      localDirection: TCoverPoint
      pointerId: number
      rotate: number
      startCenter: TCoverPoint
      startSize: TImageSize
      type: 'radius'
      which: TCoverImageWhich
    }
  | {
      pointerId: number
      startCenter: TCoverPoint
      startPoint: TCoverPoint
      startRadius: number
      type: 'magnifier-move'
      which: TCoverImageWhich
    }
  | {
      pointerId: number
      startCenter: TCoverPoint
      startRadius: number
      type: 'magnifier-radius'
      which: TCoverImageWhich
    }
  | {
      pointerId: number
      startPoint: TCoverPoint
      startZoom: number
      type: 'magnifier-zoom'
      which: TCoverImageWhich
    }
  | {
      pointerId: number
      startCanvasHeight: number
      startClientY: number
      startWrapperWidth: number
      type: 'cover-height'
      which?: null
    }
  | {
      frameHeight: number
      frameWidth: number
      pointerId: number
      rotate: number
      startClientX: number
      startClientY: number
      startCrop: TCoverImageCrop
      type: 'crop'
      which: TCoverImageWhich
    }

export type TInteractionUpdaters = {
  updateCoverHeight: (
    state: Extract<TInteractionState, { type: 'cover-height' }>,
    event: PointerEvent<HTMLElement>,
  ) => void
  updateCrop: (
    state: Extract<TInteractionState, { type: 'crop' }>,
    event: PointerEvent<HTMLElement>,
  ) => void
  updateMagnifierMove: (
    state: Extract<TInteractionState, { type: 'magnifier-move' }>,
    point: TCoverPoint,
  ) => void
  updateMagnifierRadius: (
    state: Extract<TInteractionState, { type: 'magnifier-radius' }>,
    point: TCoverPoint,
  ) => void
  updateMagnifierZoom: (
    state: Extract<TInteractionState, { type: 'magnifier-zoom' }>,
    point: TCoverPoint,
  ) => void
  updateMove: (state: Extract<TInteractionState, { type: 'move' }>, point: TCoverPoint) => void
  updateRadius: (state: Extract<TInteractionState, { type: 'radius' }>, point: TCoverPoint) => void
  updateResize: (state: Extract<TInteractionState, { type: 'resize' }>, point: TCoverPoint) => void
}

export type TEditorInteraction = 'idle' | 'move' | 'resize' | 'crop' | 'other'
export type TMagnifierInteraction = 'idle' | 'move' | 'radius' | 'zoom'

/** Rejects secondary touches and non-left mouse buttons before pointer capture is acquired. */
export const isPrimaryPointer = (event: PointerEvent<HTMLElement>): boolean =>
  event.isPrimary && (event.pointerType !== 'mouse' || event.button === 0)

/** Maps the shared interaction state to the smaller visual contract used by the editor frame. */
export const deriveEditorInteraction = (
  mode: TInteractionMode,
  state: TInteractionState | null,
  which: TCoverImageWhich,
): TEditorInteraction => {
  if (state?.which !== which) return 'idle'
  if (mode === 'move' || mode === 'resize' || mode === 'crop') return mode
  return mode === 'idle' ? 'idle' : 'other'
}

/** Maps magnifier-specific modes without leaking the full interaction union into its renderer. */
export const deriveMagnifierInteraction = (
  mode: TInteractionMode,
  state: TInteractionState | null,
  which: TCoverImageWhich,
): TMagnifierInteraction => {
  if (state?.which !== which) return 'idle'
  if (mode === 'magnifier-move') return 'move'
  if (mode === 'magnifier-radius') return 'radius'
  if (mode === 'magnifier-zoom') return 'zoom'
  return 'idle'
}

/** Normalizes interaction geometry without depending on React or the image draft store. */
export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/** Runs the clamp cover height operation at the frontend shared boundary. */
export const clampCoverHeight = (height: number): number =>
  Math.min(COVER_HEIGHT_RANGE.MAX, Math.max(COVER_HEIGHT_RANGE.MIN, Math.round(height)))

/** Returns magnifier radius from canvas point for the frontend shared workflow. */
export const getMagnifierRadiusFromCanvasPoint = (
  point: TCoverPoint,
  center: TCoverPoint,
  startRadius: number,
  canvas: { canvasWidth: number; canvasHeight: number },
): number => {
  const centerPoint = { x: center.x * canvas.canvasWidth, y: center.y * canvas.canvasHeight }
  const distance = Math.sqrt((point.x - centerPoint.x) ** 2 + (point.y - centerPoint.y) ** 2)
  const minRadius = MAGNIFIER_RENDER_SIZE.MIN / 2
  const maxRadius = MAGNIFIER_RENDER_SIZE.MAX / 2
  if (distance <= 0) return startRadius
  return clamp01((distance - minRadius) / (maxRadius - minRadius))
}

/** Runs the clamp magnifier zoom operation at the frontend shared boundary. */
export const clampMagnifierZoom = (zoom: number): number =>
  Math.min(MAGNIFIER_ZOOM_RANGE.MAX, Math.max(MAGNIFIER_ZOOM_RANGE.MIN, Number(zoom.toFixed(1))))
