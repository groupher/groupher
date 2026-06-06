import { IMAGE_SHADOW_RANGE } from './constant'

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const formatAlpha = (value: number): string => Number(value.toFixed(3)).toString()

const SHADOW_RESPONSE_CURVE = 0.6

export const getImageShadow = (shadow: number): string | undefined => {
  const rawRatio =
    clamp(shadow, IMAGE_SHADOW_RANGE.MIN, IMAGE_SHADOW_RANGE.MAX) / IMAGE_SHADOW_RANGE.MAX

  if (rawRatio <= 0) return undefined

  const ratio = rawRatio ** SHADOW_RESPONSE_CURVE

  const mainY = Math.round(25 * ratio)
  const mainBlur = Math.round(50 * ratio)
  const mainSpread = Math.round(-12 * ratio)
  const softY = Math.round(10 * ratio)
  const softBlur = Math.round(14 * ratio)
  const softSpread = Math.round(-5 * ratio)

  return [
    `rgba(0, 0, 0, ${formatAlpha(0.25 * ratio)}) 0px ${mainY}px ${mainBlur}px ${mainSpread}px`,
    `rgba(0, 0, 0, ${formatAlpha(0.05 * ratio)}) 0px ${softY}px ${softBlur}px ${softSpread}px`,
  ].join(', ')
}
