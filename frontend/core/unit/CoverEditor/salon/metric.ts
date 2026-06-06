import { GRADIENT_DIRECTION } from '~/const/wallpaper'
import type { TWallpaperGradientDir } from '~/spec'

import { COVER_IMAGE_MIN_VISIBLE_SIZE, IMAGE_CONTAINER_SIZE, IMAGE_RATIO_SIZE } from '../constant'
import type { TCoverPoint, TImageRadio, TImageSize, TImageSizeValue } from '../spec'

const CANVAS_WIDTH = Number.parseFloat(IMAGE_CONTAINER_SIZE.WIDTH)
const CANVAS_HEIGHT = Number.parseFloat(IMAGE_CONTAINER_SIZE.HEIGHT)

const getRatioValue = (ratio: TImageRadio): number => {
  const ratioSize = IMAGE_RATIO_SIZE[ratio]

  return Number.parseFloat(ratioSize.width) / Number.parseFloat(ratioSize.height)
}

export const getImageSize = (size: TImageSize, ratio: TImageRadio): TImageSizeValue => {
  const scale = size / 100
  const ratioValue = getRatioValue(ratio)
  const height = CANVAS_HEIGHT * scale
  const width = height * ratioValue

  return {
    width: `${width}px`,
    height: `${height}px`,
  }
}

const toCanvasPercent = (value: string, base: string): string => {
  return `${(Number.parseFloat(value) / Number.parseFloat(base)) * 100}%`
}

export const getResponsiveImageSize = (size: TImageSize, ratio: TImageRadio): TImageSizeValue => {
  const imageSize = getImageSize(size, ratio)

  return {
    width: toCanvasPercent(imageSize.width, IMAGE_CONTAINER_SIZE.WIDTH),
    height: toCanvasPercent(imageSize.height, IMAGE_CONTAINER_SIZE.HEIGHT),
  }
}

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360

const getImageSizeNumber = (
  size: TImageSize,
  ratio: TImageRadio,
): { width: number; height: number } => {
  const imageSize = getImageSize(size, ratio)

  return {
    width: Number.parseFloat(imageSize.width),
    height: Number.parseFloat(imageSize.height),
  }
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
  ratio: TImageRadio,
  rotate: number,
): { minX: number; maxX: number; minY: number; maxY: number } => {
  const imageSize = getImageSizeNumber(size, ratio)
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
  ratio: TImageRadio,
  rotate: number,
): { left: string; top: string } => {
  const { minX, maxX, minY, maxY } = getPlacementBounds(size, ratio, rotate)

  return {
    left: `${(getCenterValue(position.x, minX, maxX) / CANVAS_WIDTH) * 100}%`,
    top: `${(getCenterValue(position.y, minY, maxY) / CANVAS_HEIGHT) * 100}%`,
  }
}

export const getImagePositionFromCanvasPoint = (
  point: TCoverPoint,
  size: TImageSize,
  ratio: TImageRadio,
  rotate: number,
): TCoverPoint => {
  const { minX, maxX, minY, maxY } = getPlacementBounds(size, ratio, rotate)
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
