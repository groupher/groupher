import { BORDER_HIGHLIGHT_LENGTH_RANGE } from '../../../../constant'
import type { TBorderHighlight } from '../../../../spec'
import { VIEWBOX } from './constant'

type TPoint = {
  x: number
  y: number
}

type TPointerBorderHighlight = {
  angle: number
  length: number
}

export const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360

export const clampLength = (length: number): number =>
  Math.min(BORDER_HIGHLIGHT_LENGTH_RANGE.MAX, Math.max(BORDER_HIGHLIGHT_LENGTH_RANGE.MIN, length))

const getDistanceFromLength = (length: number): number => {
  const normalized =
    (clampLength(length) - BORDER_HIGHLIGHT_LENGTH_RANGE.MIN) /
    (BORDER_HIGHLIGHT_LENGTH_RANGE.MAX - BORDER_HIGHLIGHT_LENGTH_RANGE.MIN)

  return VIEWBOX.minDistance + normalized * (VIEWBOX.maxDistance - VIEWBOX.minDistance)
}

export const getHandlePoint = ({ angle, length }: TBorderHighlight): TPoint => {
  const rad = (normalizeAngle(angle) * Math.PI) / 180
  const distance = getDistanceFromLength(length)

  return {
    x: VIEWBOX.centerX + Math.cos(rad) * distance,
    y: VIEWBOX.centerY + Math.sin(rad) * distance,
  }
}

export const getPointFromPointer = (clientX: number, clientY: number, rect: DOMRect): TPoint => ({
  x: ((clientX - rect.left) / rect.width) * VIEWBOX.width,
  y: ((clientY - rect.top) / rect.height) * VIEWBOX.height,
})

export const getBorderHighlightFromPoint = ({ x, y }: TPoint): TPointerBorderHighlight => {
  const dx = x - VIEWBOX.centerX
  const dy = y - VIEWBOX.centerY

  // Pointer distance controls highlight length while the pointer angle controls the visible arc.
  const distance = Math.min(
    VIEWBOX.maxDistance,
    Math.max(VIEWBOX.minDistance, Math.sqrt(dx * dx + dy * dy)),
  )
  const length =
    BORDER_HIGHLIGHT_LENGTH_RANGE.MIN +
    ((distance - VIEWBOX.minDistance) / (VIEWBOX.maxDistance - VIEWBOX.minDistance)) *
      (BORDER_HIGHLIGHT_LENGTH_RANGE.MAX - BORDER_HIGHLIGHT_LENGTH_RANGE.MIN)

  return {
    angle: normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI),
    length,
  }
}
