import {
  COVER_IMAGE_MIN_VISIBLE_SIZE,
  IMAGE_BORDER_RADIUS_RANGE,
  IMAGE_CONTAINER_SIZE,
  IMAGE_SIZE_RANGE,
} from '../constant'
import type { TCoverCanvas, TCoverPoint, TImageSize, TImageSizeValue } from '../spec'

const CANVAS_WIDTH = Number.parseFloat(IMAGE_CONTAINER_SIZE.WIDTH)
const CANVAS_HEIGHT = Number.parseFloat(IMAGE_CONTAINER_SIZE.HEIGHT)
const DEFAULT_CANVAS: TCoverCanvas = {
  canvasWidth: CANVAS_WIDTH,
  canvasHeight: CANVAS_HEIGHT,
}

const getCanvasSize = (
  canvas: Partial<Pick<TCoverCanvas, 'canvasWidth' | 'canvasHeight'>> = DEFAULT_CANVAS,
): { width: number; height: number } => ({
  width: canvas.canvasWidth ?? DEFAULT_CANVAS.canvasWidth,
  height: canvas.canvasHeight ?? DEFAULT_CANVAS.canvasHeight,
})

export const getCoverRenderCanvas = ({ canvasWidth, canvasHeight }: TCoverCanvas): TCoverCanvas => {
  if (!Number.isFinite(canvasWidth) || !Number.isFinite(canvasHeight) || canvasWidth <= 0) {
    return DEFAULT_CANVAS
  }

  return {
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: (CANVAS_WIDTH * canvasHeight) / canvasWidth,
  }
}

export const getImageSize = (
  size: TImageSize,
  canvas: Partial<Pick<TCoverCanvas, 'canvasWidth' | 'canvasHeight'>> = DEFAULT_CANVAS,
): TImageSizeValue => {
  const scale = size / 100
  const canvasSize = getCanvasSize(canvas)

  return {
    width: `${canvasSize.width * scale}px`,
    height: `${canvasSize.height * scale}px`,
  }
}

const toCanvasPercent = (value: string, base: string): string => {
  return `${(Number.parseFloat(value) / Number.parseFloat(base)) * 100}%`
}

export const getResponsiveImageSize = (
  size: TImageSize,
  canvas: Partial<Pick<TCoverCanvas, 'canvasWidth' | 'canvasHeight'>> = DEFAULT_CANVAS,
): TImageSizeValue => {
  const imageSize = getImageSize(size, canvas)
  const canvasSize = getCanvasSize(canvas)

  return {
    width: toCanvasPercent(imageSize.width, `${canvasSize.width}px`),
    height: toCanvasPercent(imageSize.height, `${canvasSize.height}px`),
  }
}

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360

const getImageSizeNumber = (
  size: TImageSize,
  canvas: Partial<Pick<TCoverCanvas, 'canvasWidth' | 'canvasHeight'>> = DEFAULT_CANVAS,
): { width: number; height: number } => {
  const imageSize = getImageSize(size, canvas)

  return {
    width: Number.parseFloat(imageSize.width),
    height: Number.parseFloat(imageSize.height),
  }
}

export type TImageResizeHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

type TResizeParams = {
  canvas?: Partial<Pick<TCoverCanvas, 'canvasWidth' | 'canvasHeight'>>
  handle: TImageResizeHandle
  point: TCoverPoint
  rotate: number
  startCenter: TCoverPoint
  startSize: TImageSize
}

type TResizeResult = {
  center: TCoverPoint
  size: TImageSize
}

type TRadiusParams = {
  canvas?: Partial<Pick<TCoverCanvas, 'canvasWidth' | 'canvasHeight'>>
  center: TCoverPoint
  handle: TImageResizeHandle
  localDirection: TCoverPoint
  point: TCoverPoint
  rotate: number
  size: TImageSize
}

const RESIZE_HANDLE_SIGN: Record<TImageResizeHandle, { x: -1 | 1; y: -1 | 1 }> = {
  'top-left': { x: -1, y: -1 },
  'top-right': { x: 1, y: -1 },
  'bottom-left': { x: -1, y: 1 },
  'bottom-right': { x: 1, y: 1 },
}

const clampImageSize = (size: number): TImageSize =>
  Math.min(IMAGE_SIZE_RANGE.MAX, Math.max(IMAGE_SIZE_RANGE.MIN, Math.round(size)))

const clampBorderRadius = (radius: number): number =>
  Math.min(
    IMAGE_BORDER_RADIUS_RANGE.MAX,
    Math.max(IMAGE_BORDER_RADIUS_RANGE.MIN, Math.round(radius)),
  )

const BORDER_RADIUS_HANDLE_MIN_LENGTH = 24

const rotatePoint = (point: TCoverPoint, rotate: number): TCoverPoint => {
  const rad = (normalizeAngle(rotate) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}

export const getImageCanvasSize = (size: TImageSize): { width: number; height: number } =>
  getImageSizeNumber(size)

const getResizeHandleOffset = (
  handle: TImageResizeHandle,
  size: TImageSize,
  rotate: number,
  canvas: Partial<Pick<TCoverCanvas, 'canvasWidth' | 'canvasHeight'>> = DEFAULT_CANVAS,
): TCoverPoint => {
  const sign = RESIZE_HANDLE_SIGN[handle]
  const frameSize = getImageSizeNumber(size, canvas)

  return rotatePoint(
    {
      x: (sign.x * frameSize.width) / 2,
      y: (sign.y * frameSize.height) / 2,
    },
    rotate,
  )
}

const getRotatedSize = (
  width: number,
  height: number,
  rotate: number,
): { width: number; height: number } => {
  const rad = (normalizeAngle(rotate) * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))

  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos,
  }
}

const getPlacementBounds = (
  size: TImageSize,
  rotate: number,
  canvas: Partial<Pick<TCoverCanvas, 'canvasWidth' | 'canvasHeight'>> = DEFAULT_CANVAS,
): { minX: number; maxX: number; minY: number; maxY: number } => {
  const imageSize = getImageSizeNumber(size, canvas)
  const rotatedSize = getRotatedSize(imageSize.width, imageSize.height, rotate)
  const canvasSize = getCanvasSize(canvas)

  const getAxisBounds = (canvasSize: number, frameSize: number): { min: number; max: number } => {
    // Allow dragging outside the cover while keeping enough visible area to recover the image.
    const minVisibleSize = Math.min(COVER_IMAGE_MIN_VISIBLE_SIZE, frameSize, canvasSize)

    return {
      min: minVisibleSize - frameSize / 2,
      max: canvasSize - minVisibleSize + frameSize / 2,
    }
  }

  const xBounds = getAxisBounds(canvasSize.width, rotatedSize.width)
  const yBounds = getAxisBounds(canvasSize.height, rotatedSize.height)

  return {
    minX: xBounds.min,
    maxX: xBounds.max,
    minY: yBounds.min,
    maxY: yBounds.max,
  }
}

const getCenterValue = (value: number, min: number, max: number): number => {
  const range = max - min

  if (range <= 0) return (min + max) / 2

  return min + clamp01(value) * range
}

export const getImagePlacement = (
  position: TCoverPoint,
  size: TImageSize,
  rotate: number,
  canvas: Partial<Pick<TCoverCanvas, 'canvasWidth' | 'canvasHeight'>> = DEFAULT_CANVAS,
): { left: string; top: string } => {
  const { minX, maxX, minY, maxY } = getPlacementBounds(size, rotate, canvas)
  const canvasSize = getCanvasSize(canvas)

  return {
    left: `${(getCenterValue(position.x, minX, maxX) / canvasSize.width) * 100}%`,
    top: `${(getCenterValue(position.y, minY, maxY) / canvasSize.height) * 100}%`,
  }
}

export const getImageCanvasCenter = (
  position: TCoverPoint,
  size: TImageSize,
  rotate: number,
  canvas: Partial<Pick<TCoverCanvas, 'canvasWidth' | 'canvasHeight'>> = DEFAULT_CANVAS,
): TCoverPoint => {
  const { minX, maxX, minY, maxY } = getPlacementBounds(size, rotate, canvas)

  return {
    x: getCenterValue(position.x, minX, maxX),
    y: getCenterValue(position.y, minY, maxY),
  }
}

export const getImagePositionFromCanvasPoint = (
  point: TCoverPoint,
  size: TImageSize,
  rotate: number,
  canvas: Partial<Pick<TCoverCanvas, 'canvasWidth' | 'canvasHeight'>> = DEFAULT_CANVAS,
): TCoverPoint => {
  const { minX, maxX, minY, maxY } = getPlacementBounds(size, rotate, canvas)
  const xRange = maxX - minX
  const yRange = maxY - minY

  return {
    x: xRange <= 0 ? 0.5 : clamp01((point.x - minX) / xRange),
    y: yRange <= 0 ? 0.5 : clamp01((point.y - minY) / yRange),
  }
}

export const getCanvasPointFromClient = (
  clientX: number,
  clientY: number,
  rect: DOMRect,
  canvas: Partial<Pick<TCoverCanvas, 'canvasWidth' | 'canvasHeight'>> = DEFAULT_CANVAS,
): TCoverPoint => {
  const canvasSize = getCanvasSize(canvas)

  return {
    x: ((clientX - rect.left) / rect.width) * canvasSize.width,
    y: ((clientY - rect.top) / rect.height) * canvasSize.height,
  }
}

export const getImageResizeFromCanvasPoint = ({
  canvas = DEFAULT_CANVAS,
  handle,
  point,
  rotate,
  startCenter,
  startSize,
}: TResizeParams): TResizeResult => {
  const rotatedCorner = getResizeHandleOffset(handle, startSize, rotate, canvas)
  const anchor = {
    x: startCenter.x - rotatedCorner.x,
    y: startCenter.y - rotatedCorner.y,
  }
  const diagonal = {
    x: rotatedCorner.x * 2,
    y: rotatedCorner.y * 2,
  }
  const diagonalLength = diagonal.x * diagonal.x + diagonal.y * diagonal.y
  const rawScale =
    diagonalLength <= 0
      ? 1
      : ((point.x - anchor.x) * diagonal.x + (point.y - anchor.y) * diagonal.y) / diagonalLength
  const size = clampImageSize(startSize * rawScale)
  const scale = size / startSize

  return {
    size,
    center: {
      x: anchor.x + (diagonal.x * scale) / 2,
      y: anchor.y + (diagonal.y * scale) / 2,
    },
  }
}

export const getBorderRadiusFromCanvasPoint = ({
  canvas = DEFAULT_CANVAS,
  center,
  handle,
  localDirection,
  point,
  rotate,
  size,
}: TRadiusParams): number => {
  const cornerOffset = getResizeHandleOffset(handle, size, rotate, canvas)
  const corner = {
    x: center.x + cornerOffset.x,
    y: center.y + cornerOffset.y,
  }
  const direction = rotatePoint(localDirection, rotate)
  const directionLength = Math.sqrt(direction.x * direction.x + direction.y * direction.y)

  if (directionLength <= 0) return IMAGE_BORDER_RADIUS_RANGE.MIN

  const projection =
    ((point.x - corner.x) * direction.x + (point.y - corner.y) * direction.y) / directionLength

  return clampBorderRadius(projection * 2 - BORDER_RADIUS_HANDLE_MIN_LENGTH)
}
