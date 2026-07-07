import { MIN_VISUAL_RATIO } from './constant'

/**
 * Clamps a number while tolerating reversed min/max input.
 */
export const clamp = (value: number, min: number, max: number): number => {
  if (min === max) return min
  return Math.min(Math.max(value, Math.min(min, max)), Math.max(min, max))
}

/**
 * Converts a value in min/max space into a 0..100 logical ratio.
 */
export const getRatio = (value: number, min: number, max: number): number => {
  if (min === max) return 0
  return ((value - min) / (max - min)) * 100
}

/**
 * Ensures the thumb remains visually reachable near the left edge.
 */
export const getVisualRatio = (ratio: number): number =>
  clamp(Math.max(ratio, MIN_VISUAL_RATIO), 0, 100)

/**
 * Converts the visual ratio back to logical value ratio.
 */
export const getRatioFromVisualRatio = (visualRatio: number): number =>
  visualRatio <= MIN_VISUAL_RATIO ? 0 : visualRatio

/**
 * Default label formatter for compact numeric range values.
 */
export const defaultFormatValue = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1)
