import { GRADIENT_DIRECTION } from '~/const/wallpaper'
import type { TWallpaperGradientDir } from '~/spec'

import { COVER_IMAGE_MIN_VISIBLE_SIZE, IMAGE_CONTAINER_SIZE, IMAGE_SIZE_RANGE } from '../constant'
import type { TCoverPoint, TImageSize, TImageSizeValue } from '../spec'

const CANVAS_WIDTH = Number.parseFloat(IMAGE_CONTAINER_SIZE.WIDTH)
const CANVAS_HEIGHT = Number.parseFloat(IMAGE_CONTAINER_SIZE.HEIGHT)

const IMAGE_FRAME_ASPECT = CANVAS_WIDTH / CANVAS_HEIGHT

export const getImageSize = (size: TImageSize): TImageSizeValue => {
  const scale = size / 100
  const height = CANVAS_HEIGHT * scale
  const width = height * IMAGE_FRAME_ASPECT

  return {
    width: `${width}px`,
    height: `${height}px`,
  }
}

const toCanvasPercent = (value: string, base: string): string => {
  return `${(Number.parseFloat(value) / Number.parseFloat(base)) * 100}%`
}

export const getResponsiveImageSize = (size: TImageSize): TImageSizeValue => {
  const imageSize = getImageSize(size)

  return {
    width: toCanvasPercent(imageSize.width, IMAGE_CONTAINER_SIZE.WIDTH),
    height: toCanvasPercent(imageSize.height, IMAGE_CONTAINER_SIZE.HEIGHT),
  }
}

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360

const getImageSizeNumber = (size: TImageSize): { width: number; height: number } => {
  const imageSize = getImageSize(size)

  return {
    width: Number.parseFloat(imageSize.width),
    height: Number.parseFloat(imageSize.height),
  }
}

export type TImageResizeHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

type TResizeParams = {
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

const RESIZE_HANDLE_SIGN: Record<TImageResizeHandle, { x: -1 | 1; y: -1 | 1 }> = {
  'top-left': { x: -1, y: -1 },
  'top-right': { x: 1, y: -1 },
  'bottom-left': { x: -1, y: 1 },
  'bottom-right': { x: 1, y: 1 },
}

const clampImageSize = (size: number): TImageSize =>
  Math.min(IMAGE_SIZE_RANGE.MAX, Math.max(IMAGE_SIZE_RANGE.MIN, Math.round(size)))

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
): { minX: number; maxX: number; minY: number; maxY: number } => {
  const imageSize = getImageSizeNumber(size)
  const rotatedSize = getRotatedSize(imageSize.width, imageSize.height, rotate)

  const getAxisBounds = (canvasSize: number, frameSize: number): { min: number; max: number } => {
    // Allow dragging outside the cover while keeping enough visible area to recover the image.
    const minVisibleSize = Math.min(COVER_IMAGE_MIN_VISIBLE_SIZE, frameSize, canvasSize)

    return {
      min: minVisibleSize - frameSize / 2,
      max: canvasSize - minVisibleSize + frameSize / 2,
    }
  }

  const xBounds = getAxisBounds(CANVAS_WIDTH, rotatedSize.width)
  const yBounds = getAxisBounds(CANVAS_HEIGHT, rotatedSize.height)

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
): { left: string; top: string } => {
  const { minX, maxX, minY, maxY } = getPlacementBounds(size, rotate)

  return {
    left: `${(getCenterValue(position.x, minX, maxX) / CANVAS_WIDTH) * 100}%`,
    top: `${(getCenterValue(position.y, minY, maxY) / CANVAS_HEIGHT) * 100}%`,
  }
}

export const getImageCanvasCenter = (
  position: TCoverPoint,
  size: TImageSize,
  rotate: number,
): TCoverPoint => {
  const { minX, maxX, minY, maxY } = getPlacementBounds(size, rotate)

  return {
    x: getCenterValue(position.x, minX, maxX),
    y: getCenterValue(position.y, minY, maxY),
  }
}

export const getImagePositionFromCanvasPoint = (
  point: TCoverPoint,
  size: TImageSize,
  rotate: number,
): TCoverPoint => {
  const { minX, maxX, minY, maxY } = getPlacementBounds(size, rotate)
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
): TCoverPoint => {
  return {
    x: ((clientX - rect.left) / rect.width) * CANVAS_WIDTH,
    y: ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
  }
}

export const getImageResizeFromCanvasPoint = ({
  handle,
  point,
  rotate,
  startCenter,
  startSize,
}: TResizeParams): TResizeResult => {
  const sign = RESIZE_HANDLE_SIGN[handle]
  const startFrameSize = getImageCanvasSize(startSize)
  const rotatedCorner = rotatePoint(
    {
      x: (sign.x * startFrameSize.width) / 2,
      y: (sign.y * startFrameSize.height) / 2,
    },
    rotate,
  )
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

export const getBgGradientDirAngle = (dir: TWallpaperGradientDir): string => {
  switch (dir) {
    case GRADIENT_DIRECTION.TOP: {
      return '90deg'
    }
    case GRADIENT_DIRECTION.TOP_RIGHT: {
      return '135deg'
    }
    case GRADIENT_DIRECTION.RIGHT: {
      return '180deg'
    }
    case GRADIENT_DIRECTION.BOTTOM_RIGHT: {
      return '225deg'
    }
    case GRADIENT_DIRECTION.BOTTOM: {
      return '270deg'
    }
    case GRADIENT_DIRECTION.BOTTOM_LEFT: {
      return '315deg'
    }
    case GRADIENT_DIRECTION.LEFT: {
      return '0'
    }
    // TOP_LEFT
    default: {
      return '45deg'
    }
  }
}
