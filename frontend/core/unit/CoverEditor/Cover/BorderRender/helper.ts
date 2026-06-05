import { IMAGE_CONTAINER_SIZE, IMAGE_RATIO_SIZE } from '../../constant'
import type { TBorderHighlight, TImageRadio, TImageSize } from '../../spec'

type TPoint = {
  x: number
  y: number
}

type TRect = TPoint & {
  width: number
  height: number
}

type TRoundedRect = TRect & {
  radius: number
}

export type TBorderRenderSegment = {
  path: string
  width: number
}

type TGeometryParams = {
  borderRadius: string
  borderHighlight: TBorderHighlight
  ratio: TImageRadio
  size: TImageSize
}

export type TBorderRenderGeometry = {
  clipPath: string
  segments: TBorderRenderSegment[]
  viewBox: string
}

const VIEWBOX = {
  HEIGHT: 100,
  CLIP_PAD: 8,
  MAX_STROKE_WIDTH: 3.2,
  SAMPLE_STEP: 1.15,
  MIN_SAMPLES: 42,
  TAPER_PORTION: 0.45,
} as const

const EPSILON = 0.0001

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360

const normalizeRadians = (angle: number): number => {
  const full = Math.PI * 2

  return ((angle % full) + full) % full
}

const getRatioValue = (ratio: TImageRadio): number => {
  const ratioSize = IMAGE_RATIO_SIZE[ratio]

  return Number.parseFloat(ratioSize.width) / Number.parseFloat(ratioSize.height)
}

const getSvgRadius = (borderRadius: string, size: TImageSize): number => {
  const radius = Number.parseFloat(borderRadius)

  if (Number.isNaN(radius)) return 0

  const baseHeight = Number.parseFloat(IMAGE_CONTAINER_SIZE.HEIGHT)
  const imageHeight = baseHeight * (Math.max(1, size) / 100)

  return (radius / imageHeight) * VIEWBOX.HEIGHT
}

const getEdgeRect = (ratio: TImageRadio): TRect => {
  const width = VIEWBOX.HEIGHT * getRatioValue(ratio)

  return {
    x: 0,
    y: 0,
    width,
    height: VIEWBOX.HEIGHT,
  }
}

const getRoundedRect = (
  ratio: TImageRadio,
  borderRadius: string,
  size: TImageSize,
): TRoundedRect => {
  const rect = getEdgeRect(ratio)
  const radius = Math.min(getSvgRadius(borderRadius, size), rect.width / 2, rect.height / 2)

  return {
    ...rect,
    radius,
  }
}

const getMetrics = ({ width, height, radius }: TRoundedRect) => {
  const lineWidth = Math.max(0, width - radius * 2)
  const lineHeight = Math.max(0, height - radius * 2)
  const arc = (Math.PI * radius) / 2
  const perimeter = lineWidth * 2 + lineHeight * 2 + arc * 4

  return {
    lineWidth,
    lineHeight,
    arc,
    perimeter,
  }
}

const isBetween = (value: number, min: number, max: number): boolean =>
  value >= min - EPSILON && value <= max + EPSILON

// Maps a joystick angle to the nearest point where a ray from center hits the rounded rect.
// Example: 0deg is centered on the right edge, 90deg on the bottom edge.
const getBorderPointProgress = (angle: number, rect: TRoundedRect): number => {
  const rad = (normalizeAngle(angle) * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const origin = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  }
  const { lineWidth, lineHeight, arc, perimeter } = getMetrics(rect)
  const r = rect.radius
  const candidates: Array<{ distance: number; t: number }> = []

  const addLineCandidate = (t: number, distance: number): void => {
    if (t > EPSILON) candidates.push({ distance, t })
  }

  if (Math.abs(dy) > EPSILON) {
    const topT = (rect.y - origin.y) / dy
    const topX = origin.x + dx * topT
    if (dy < 0 && isBetween(topX, rect.x + r, rect.x + rect.width - r)) {
      addLineCandidate(topT, topX - rect.x - r)
    }

    const bottomT = (rect.y + rect.height - origin.y) / dy
    const bottomX = origin.x + dx * bottomT
    if (dy > 0 && isBetween(bottomX, rect.x + r, rect.x + rect.width - r)) {
      addLineCandidate(
        bottomT,
        lineWidth + arc + lineHeight + arc + rect.x + rect.width - r - bottomX,
      )
    }
  }

  if (Math.abs(dx) > EPSILON) {
    const rightT = (rect.x + rect.width - origin.x) / dx
    const rightY = origin.y + dy * rightT
    if (dx > 0 && isBetween(rightY, rect.y + r, rect.y + rect.height - r)) {
      addLineCandidate(rightT, lineWidth + arc + rightY - rect.y - r)
    }

    const leftT = (rect.x - origin.x) / dx
    const leftY = origin.y + dy * leftT
    if (dx < 0 && isBetween(leftY, rect.y + r, rect.y + rect.height - r)) {
      addLineCandidate(
        leftT,
        lineWidth * 2 + lineHeight + arc * 3 + rect.y + rect.height - r - leftY,
      )
    }
  }

  if (r > 0) {
    const addArcCandidates = (
      center: TPoint,
      startAngle: number,
      endAngle: number,
      distanceOffset: number,
    ): void => {
      const ox = origin.x - center.x
      const oy = origin.y - center.y
      const b = 2 * (ox * dx + oy * dy)
      const c = ox * ox + oy * oy - r * r
      const discriminant = b * b - 4 * c

      if (discriminant < 0) return

      for (const t of [(-b - Math.sqrt(discriminant)) / 2, (-b + Math.sqrt(discriminant)) / 2]) {
        if (t <= EPSILON) continue

        const point = {
          x: origin.x + dx * t,
          y: origin.y + dy * t,
        }
        const arcAngle = normalizeRadians(Math.atan2(point.y - center.y, point.x - center.x))
        const normalizedStart = normalizeRadians(startAngle)
        const normalizedEnd = normalizeRadians(endAngle)
        const delta = normalizeRadians(arcAngle - normalizedStart)
        const arcRange = normalizeRadians(normalizedEnd - normalizedStart)

        if (delta <= arcRange + EPSILON) {
          candidates.push({
            distance: distanceOffset + delta * r,
            t,
          })
        }
      }
    }

    addArcCandidates({ x: rect.x + rect.width - r, y: rect.y + r }, -Math.PI / 2, 0, lineWidth)
    addArcCandidates(
      { x: rect.x + rect.width - r, y: rect.y + rect.height - r },
      0,
      Math.PI / 2,
      lineWidth + arc + lineHeight,
    )
    addArcCandidates(
      { x: rect.x + r, y: rect.y + rect.height - r },
      Math.PI / 2,
      Math.PI,
      lineWidth + arc + lineHeight + arc + lineWidth,
    )
    addArcCandidates(
      { x: rect.x + r, y: rect.y + r },
      Math.PI,
      (Math.PI * 3) / 2,
      lineWidth + arc + lineHeight + arc + lineWidth + arc + lineHeight,
    )
  }

  const candidate = candidates.sort((a, b) => a.t - b.t)[0]

  return candidate ? (candidate.distance / perimeter) % 1 : 0
}

const getRectPointAtDistance = (rect: TRect, distance: number): TPoint => {
  const perimeter = rect.width * 2 + rect.height * 2
  const d = ((distance % perimeter) + perimeter) % perimeter

  if (d <= rect.width) return { x: rect.x + d, y: rect.y }
  if (d <= rect.width + rect.height) {
    return { x: rect.x + rect.width, y: rect.y + d - rect.width }
  }
  if (d <= rect.width * 2 + rect.height) {
    return {
      x: rect.x + rect.width - (d - rect.width - rect.height),
      y: rect.y + rect.height,
    }
  }

  return {
    x: rect.x,
    y: rect.y + rect.height - (d - rect.width * 2 - rect.height),
  }
}

const getPointAtDistance = (rect: TRoundedRect, distance: number): TPoint => {
  if (rect.radius <= 0) return getRectPointAtDistance(rect, distance)

  const { lineWidth, lineHeight, arc, perimeter } = getMetrics(rect)
  let d = ((distance % perimeter) + perimeter) % perimeter
  const r = rect.radius

  if (d <= lineWidth) return { x: rect.x + r + d, y: rect.y }
  d -= lineWidth

  if (d <= arc) {
    const angle = -Math.PI / 2 + d / r

    return {
      x: rect.x + rect.width - r + Math.cos(angle) * r,
      y: rect.y + r + Math.sin(angle) * r,
    }
  }
  d -= arc

  if (d <= lineHeight) return { x: rect.x + rect.width, y: rect.y + r + d }
  d -= lineHeight

  if (d <= arc) {
    const angle = d / r

    return {
      x: rect.x + rect.width - r + Math.cos(angle) * r,
      y: rect.y + rect.height - r + Math.sin(angle) * r,
    }
  }
  d -= arc

  if (d <= lineWidth) return { x: rect.x + rect.width - r - d, y: rect.y + rect.height }
  d -= lineWidth

  if (d <= arc) {
    const angle = Math.PI / 2 + d / r

    return {
      x: rect.x + r + Math.cos(angle) * r,
      y: rect.y + rect.height - r + Math.sin(angle) * r,
    }
  }
  d -= arc

  if (d <= lineHeight) return { x: rect.x, y: rect.y + rect.height - r - d }
  d -= lineHeight

  const angle = Math.PI + d / r

  return {
    x: rect.x + r + Math.cos(angle) * r,
    y: rect.y + r + Math.sin(angle) * r,
  }
}

const formatNumber = (value: number): string => Number(value.toFixed(2)).toString()

const toPathPoint = ({ x, y }: TPoint): string => `${formatNumber(x)} ${formatNumber(y)}`

const smoothStep = (value: number): number => {
  const x = clamp01(value)

  return x * x * (3 - 2 * x)
}

const getTaperWeight = (progress: number): number => {
  const edgeProgress = Math.min(progress, 1 - progress) / VIEWBOX.TAPER_PORTION

  return smoothStep(edgeProgress)
}

const getCornerDistances = (rect: TRoundedRect): number[] => {
  const { lineWidth, lineHeight, arc, perimeter } = getMetrics(rect)

  return [
    0,
    lineWidth,
    lineWidth + arc,
    lineWidth + arc + lineHeight,
    lineWidth + arc + lineHeight + arc,
    lineWidth + arc + lineHeight + arc + lineWidth,
    lineWidth + arc + lineHeight + arc + lineWidth + arc,
    lineWidth + arc + lineHeight + arc + lineWidth + arc + lineHeight,
    perimeter,
  ]
}

const getSampleDistances = (
  rect: TRoundedRect,
  startDistance: number,
  segmentLength: number,
): number[] => {
  const perimeter = getMetrics(rect).perimeter
  const endDistance = startDistance + segmentLength
  const sampleCount = Math.max(VIEWBOX.MIN_SAMPLES, Math.ceil(segmentLength / VIEWBOX.SAMPLE_STEP))
  const distances = Array.from(
    { length: sampleCount + 1 },
    (_, index) => startDistance + (segmentLength * index) / sampleCount,
  )
  const lapStart = Math.floor(startDistance / perimeter) - 1
  const lapEnd = Math.ceil(endDistance / perimeter) + 1

  for (let lap = lapStart; lap <= lapEnd; lap += 1) {
    for (const distance of getCornerDistances(rect)) {
      const cornerDistance = distance + lap * perimeter

      if (cornerDistance > startDistance && cornerDistance < endDistance) {
        distances.push(cornerDistance)
      }
    }
  }

  return [...new Set(distances.map((distance) => Number(distance.toFixed(4))))].sort(
    (a, b) => a - b,
  )
}

const getStrokeSegments = (
  rect: TRoundedRect,
  borderHighlight: TBorderHighlight,
): TBorderRenderSegment[] => {
  const perimeter = getMetrics(rect).perimeter
  const segmentLength = perimeter * clamp01(borderHighlight.length)
  const centerDistance = getBorderPointProgress(borderHighlight.angle, rect) * perimeter
  const startDistance = centerDistance - segmentLength / 2
  const distances = getSampleDistances(rect, startDistance, segmentLength)

  return distances.slice(0, -1).flatMap((start, index) => {
    const end = distances[index + 1]
    const progress = (start + end) / 2
    const width =
      VIEWBOX.MAX_STROKE_WIDTH * getTaperWeight((progress - startDistance) / segmentLength)

    if (width < 0.08) return []

    return [
      {
        path: `M ${toPathPoint(getPointAtDistance(rect, start))} L ${toPathPoint(
          getPointAtDistance(rect, end),
        )}`,
        width: Number(formatNumber(width)),
      },
    ]
  })
}

const getRoundedRectPath = ({ x, y, width, height, radius }: TRoundedRect): string => {
  if (radius <= 0) {
    return `
      M ${formatNumber(x)} ${formatNumber(y)}
      H ${formatNumber(x + width)}
      V ${formatNumber(y + height)}
      H ${formatNumber(x)}
      Z
    `
  }

  return `
    M ${formatNumber(x + radius)} ${formatNumber(y)}
    H ${formatNumber(x + width - radius)}
    A ${formatNumber(radius)} ${formatNumber(radius)} 0 0 1 ${formatNumber(x + width)} ${formatNumber(y + radius)}
    V ${formatNumber(y + height - radius)}
    A ${formatNumber(radius)} ${formatNumber(radius)} 0 0 1 ${formatNumber(x + width - radius)} ${formatNumber(y + height)}
    H ${formatNumber(x + radius)}
    A ${formatNumber(radius)} ${formatNumber(radius)} 0 0 1 ${formatNumber(x)} ${formatNumber(y + height - radius)}
    V ${formatNumber(y + radius)}
    A ${formatNumber(radius)} ${formatNumber(radius)} 0 0 1 ${formatNumber(x + radius)} ${formatNumber(y)}
    Z
  `
}

const getOutsideClipPath = (rect: TRoundedRect): string => {
  const clipPadding = VIEWBOX.CLIP_PAD

  return `
    M ${formatNumber(-clipPadding)} ${formatNumber(-clipPadding)}
    H ${formatNumber(rect.width + clipPadding)}
    V ${formatNumber(VIEWBOX.HEIGHT + clipPadding)}
    H ${formatNumber(-clipPadding)}
    Z
    ${getRoundedRectPath(rect)}
  `
}

// Generates the outer-only SVG stroke for the free border control.
// Example: angle=45 and length=0.28 draws a tapered highlight centered near top-right.
export const getBorderRenderGeometry = ({
  borderRadius,
  borderHighlight,
  ratio,
  size,
}: TGeometryParams): TBorderRenderGeometry => {
  const rect = getRoundedRect(ratio, borderRadius, size)

  return {
    clipPath: getOutsideClipPath(rect),
    segments: getStrokeSegments(rect, borderHighlight),
    viewBox: `0 0 ${formatNumber(rect.width)} ${VIEWBOX.HEIGHT}`,
  }
}
