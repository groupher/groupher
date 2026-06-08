import {
  BORDER_HIGHLIGHT_COLOR,
  BORDER_HIGHLIGHT_DEFAULT,
  BORDER_HIGHLIGHT_MODE,
  IMAGE_SHADOW_RANGE,
} from './constant'
import type { TBorderHighlight, TBorderHighlightMode } from './spec'

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const formatAlpha = (value: number): string => Number(value.toFixed(3)).toString()

const getFiniteNumber = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const SHADOW_RESPONSE_CURVE = 0.6
const RAINBOW_HUE_STOPS = [0, 28, 55, 118, 178, 224, 282, 360]

export const getImageShadow = (shadow: number): string | undefined => {
  const rawStrength =
    clamp(shadow, IMAGE_SHADOW_RANGE.MIN, IMAGE_SHADOW_RANGE.MAX) / IMAGE_SHADOW_RANGE.MAX

  if (rawStrength <= 0) return undefined

  const strength = rawStrength ** SHADOW_RESPONSE_CURVE

  const contactY = Math.round(12 * strength)
  const contactBlur = Math.round(28 * strength)
  const contactSpread = Math.round(-2 * strength)
  const ambientY = Math.round(32 * strength)
  const ambientBlur = Math.round(96 * strength)
  const ambientSpread = Math.round(6 * strength)
  const haloBlur = Math.round(36 * strength)

  // Avoid zero-blur spread layers here: on dark screenshots they read as
  // an image border instead of a soft shadow.
  return [
    `rgba(255, 255, 255, ${formatAlpha(0.22 * strength)}) 0px 0px ${haloBlur}px 0px`,
    `rgba(0, 0, 0, ${formatAlpha(0.48 * strength)}) 0px ${contactY}px ${contactBlur}px ${contactSpread}px`,
    `rgba(0, 0, 0, ${formatAlpha(0.34 * strength)}) 0px ${ambientY}px ${ambientBlur}px ${ambientSpread}px`,
  ].join(', ')
}

export const normalizeBorderHighlightHue = (hue: number | undefined): number => {
  const nextHue = getFiniteNumber(hue, BORDER_HIGHLIGHT_DEFAULT.HUE)

  return Math.round(((nextHue % 360) + 360) % 360)
}

export const normalizeBorderHighlightRainbowHue = (hue: number | undefined): number => {
  const nextHue = getFiniteNumber(hue, BORDER_HIGHLIGHT_DEFAULT.RAINBOW_HUE)

  return Math.round(((nextHue % 360) + 360) % 360)
}

export const normalizeBorderHighlightOpacity = (opacity: number | undefined): number =>
  clamp(getFiniteNumber(opacity, BORDER_HIGHLIGHT_DEFAULT.OPACITY), 0, 1)

export const normalizeBorderHighlightSaturation = (saturation: number | undefined): number =>
  clamp(getFiniteNumber(saturation, BORDER_HIGHLIGHT_DEFAULT.SATURATION), 0, 100)

export const normalizeBorderHighlightLightness = (lightness: number | undefined): number =>
  clamp(getFiniteNumber(lightness, BORDER_HIGHLIGHT_DEFAULT.LIGHTNESS), 0, 100)

export const normalizeBorderHighlightMode = (
  mode: TBorderHighlightMode | undefined,
): TBorderHighlightMode =>
  mode === BORDER_HIGHLIGHT_MODE.SOLID || mode === BORDER_HIGHLIGHT_MODE.RAINBOW
    ? mode
    : BORDER_HIGHLIGHT_DEFAULT.MODE

export const getBorderHighlightColor = (
  borderHighlight: Partial<Pick<TBorderHighlight, 'hue' | 'saturation' | 'lightness' | 'opacity'>>,
): string => {
  const hue = normalizeBorderHighlightHue(borderHighlight.hue)
  const saturation = normalizeBorderHighlightSaturation(borderHighlight.saturation)
  const lightness = normalizeBorderHighlightLightness(borderHighlight.lightness)
  const opacity = normalizeBorderHighlightOpacity(borderHighlight.opacity)

  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${formatAlpha(opacity)})`
}

export const getRainbowBorderHighlightColor = (
  progress: number,
  opacity: number | undefined,
  rainbowHue: number | undefined,
): string => {
  const clampedProgress = clamp(progress, 0, 1)
  const scaledIndex = clampedProgress * (RAINBOW_HUE_STOPS.length - 1)
  const stopIndex = Math.min(Math.floor(scaledIndex), RAINBOW_HUE_STOPS.length - 2)
  const stopProgress = scaledIndex - stopIndex
  const startHue = RAINBOW_HUE_STOPS[stopIndex]
  const endHue = RAINBOW_HUE_STOPS[stopIndex + 1]
  const hue = Math.round(startHue + (endHue - startHue) * stopProgress)
  const shiftedHue = (hue + normalizeBorderHighlightRainbowHue(rainbowHue)) % 360
  const alpha = normalizeBorderHighlightOpacity(opacity)

  return `hsla(${shiftedHue}, ${BORDER_HIGHLIGHT_COLOR.RAINBOW_SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.RAINBOW_LIGHTNESS}%, ${formatAlpha(alpha)})`
}
