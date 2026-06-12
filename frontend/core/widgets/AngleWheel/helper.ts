import { circularAngleDistance, normalizeSignedAngle } from '~/lib/angle'

import {
  DOT_SIZE,
  GUIDE_ARC_SPAN,
  MAJOR_TICK_INNER_RADIUS,
  SNAP_STEP,
  SNAP_THRESHOLD,
  TICK_INNER_RADIUS,
  TICK_OUTER_RADIUS,
  WHEEL_RADIUS,
} from './constant'

type TPoint = {
  x: number
  y: number
}

type TPosition = {
  left: number
  top: number
}

type TLine = {
  x1: number
  y1: number
  x2: number
  y2: number
}

// All exported helpers return the widget's public angle model: -180..180.
// Internally, the geometry still uses circular trig so equivalent values such
// as -10deg and 350deg render in the same physical position.
export const snapAngle = (angle: number): number => {
  const normalizedAngle = normalizeSignedAngle(angle)
  const target = Math.round(normalizedAngle / SNAP_STEP) * SNAP_STEP

  if (circularAngleDistance(normalizedAngle, target) <= SNAP_THRESHOLD) {
    return normalizeSignedAngle(target)
  }

  return normalizedAngle
}

export const angleFromPointer = (clientX: number, clientY: number, rect: DOMRect): number => {
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const mathAngle = (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI

  return snapAngle(mathAngle + 90)
}

export const pointFromAngle = (angle: number): TPosition => {
  const rad = (angle * Math.PI) / 180
  const x = Math.sin(rad) * WHEEL_RADIUS
  const y = -Math.cos(rad) * WHEEL_RADIUS

  return {
    left: WHEEL_RADIUS + x - DOT_SIZE / 2,
    top: WHEEL_RADIUS + y - DOT_SIZE / 2,
  }
}

// SVG coordinates are local to the dial viewBox. Keep this private so callers
// don't start depending on low-level geometry when they only need UI outputs.
const svgPointFromAngle = (angle: number): TPoint => {
  const rad = (angle * Math.PI) / 180

  return {
    x: WHEEL_RADIUS + Math.sin(rad) * WHEEL_RADIUS,
    y: WHEEL_RADIUS - Math.cos(rad) * WHEEL_RADIUS,
  }
}

export const tickLineFromAngle = (angle: number, major: boolean): TLine => {
  const rad = (angle * Math.PI) / 180
  const innerRadius = major ? MAJOR_TICK_INNER_RADIUS : TICK_INNER_RADIUS

  return {
    x1: WHEEL_RADIUS + Math.sin(rad) * innerRadius,
    y1: WHEEL_RADIUS - Math.cos(rad) * innerRadius,
    x2: WHEEL_RADIUS + Math.sin(rad) * TICK_OUTER_RADIUS,
    y2: WHEEL_RADIUS - Math.cos(rad) * TICK_OUTER_RADIUS,
  }
}

export const arcPathFromAngle = (angle: number): string => {
  const start = svgPointFromAngle(angle - GUIDE_ARC_SPAN / 2)
  const end = svgPointFromAngle(angle + GUIDE_ARC_SPAN / 2)

  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${WHEEL_RADIUS} ${WHEEL_RADIUS} 0 0 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`
}
