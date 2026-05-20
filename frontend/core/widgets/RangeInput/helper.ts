import { MIN_VISUAL_RATIO } from './constant'

export const clamp = (value: number, min: number, max: number): number => {
  if (min === max) return min
  return Math.min(Math.max(value, Math.min(min, max)), Math.max(min, max))
}

export const getRatio = (value: number, min: number, max: number): number => {
  if (min === max) return 0
  return ((value - min) / (max - min)) * 100
}

export const getVisualRatio = (ratio: number): number =>
  clamp(Math.max(ratio, MIN_VISUAL_RATIO), 0, 100)

export const getRatioFromVisualRatio = (visualRatio: number): number =>
  visualRatio <= MIN_VISUAL_RATIO ? 0 : visualRatio

export const defaultFormatValue = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1)
