import { BORDER_HIGHLIGHT_COLOR, BORDER_HIGHLIGHT_DEFAULT, IMAGE_SHADOW_RANGE } from './constant'
import type { TBorderHighlight } from './spec'

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const formatAlpha = (value: number): string => Number(value.toFixed(3)).toString()

const getFiniteNumber = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const SHADOW_RESPONSE_CURVE = 0.6

export const getImageShadow = (shadow: number): string | undefined => {
  const rawRatio =
    clamp(shadow, IMAGE_SHADOW_RANGE.MIN, IMAGE_SHADOW_RANGE.MAX) / IMAGE_SHADOW_RANGE.MAX

  if (rawRatio <= 0) return undefined

  const ratio = rawRatio ** SHADOW_RESPONSE_CURVE

  const contactY = Math.round(12 * ratio)
  const contactBlur = Math.round(28 * ratio)
  const contactSpread = Math.round(-2 * ratio)
  const ambientY = Math.round(32 * ratio)
  const ambientBlur = Math.round(96 * ratio)
  const ambientSpread = Math.round(6 * ratio)
  const haloBlur = Math.round(36 * ratio)

  // Avoid zero-blur spread layers here: on dark screenshots they read as
  // an image border instead of a soft shadow.
  return [
    `rgba(255, 255, 255, ${formatAlpha(0.22 * ratio)}) 0px 0px ${haloBlur}px 0px`,
    `rgba(0, 0, 0, ${formatAlpha(0.48 * ratio)}) 0px ${contactY}px ${contactBlur}px ${contactSpread}px`,
    `rgba(0, 0, 0, ${formatAlpha(0.34 * ratio)}) 0px ${ambientY}px ${ambientBlur}px ${ambientSpread}px`,
  ].join(', ')
}

export const normalizeBorderHighlightHue = (hue: number | undefined): number => {
  const nextHue = getFiniteNumber(hue, BORDER_HIGHLIGHT_DEFAULT.HUE)

  return Math.round(((nextHue % 360) + 360) % 360)
}

export const normalizeBorderHighlightOpacity = (opacity: number | undefined): number =>
  clamp(getFiniteNumber(opacity, BORDER_HIGHLIGHT_DEFAULT.OPACITY), 0, 1)

export const getBorderHighlightColor = (
  borderHighlight: Partial<Pick<TBorderHighlight, 'hue' | 'opacity'>>,
): string => {
  const hue = normalizeBorderHighlightHue(borderHighlight.hue)
  const opacity = normalizeBorderHighlightOpacity(borderHighlight.opacity)

  return `hsla(${hue}, ${BORDER_HIGHLIGHT_COLOR.SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.LIGHTNESS}%, ${formatAlpha(opacity)})`
}
