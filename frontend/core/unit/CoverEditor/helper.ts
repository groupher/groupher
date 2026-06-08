import {
  BORDER_HIGHLIGHT_COLOR,
  BORDER_HIGHLIGHT_DEFAULT,
  BORDER_HIGHLIGHT_MODE,
  COVER_SHADOW_COLOR_MODE,
  COVER_SHADOW_DEFAULT,
  COVER_SHADOW_PRESET,
  COVER_SHADOW_RANGE,
} from './constant'
import type {
  TBorderHighlight,
  TBorderHighlightMode,
  TCoverShadow,
  TCoverShadowColorMode,
  TCoverShadowPreset,
} from './spec'

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const formatAlpha = (value: number): string => Number(value.toFixed(3)).toString()

const getFiniteNumber = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const RAINBOW_HUE_STOPS = [0, 28, 55, 118, 178, 224, 282, 360]

type TShadowCssParams = Pick<TCoverShadow, 'x' | 'y' | 'blur' | 'spread' | 'opacity'>

const SHADOW_PRESET_PARAMS: Record<Exclude<TCoverShadowPreset, 'custom'>, TShadowCssParams> = {
  [COVER_SHADOW_PRESET.NONE]: {
    x: 0,
    y: 0,
    blur: 0,
    spread: 0,
    opacity: 0,
  },
  [COVER_SHADOW_PRESET.XSMALL]: {
    x: 0,
    y: 5,
    blur: 12,
    spread: -4,
    opacity: 0.22,
  },
  [COVER_SHADOW_PRESET.SMALL]: {
    x: 0,
    y: 8,
    blur: 20,
    spread: -3,
    opacity: 0.28,
  },
  [COVER_SHADOW_PRESET.MEDIUM]: {
    x: 0,
    y: 12,
    blur: 34,
    spread: -2,
    opacity: 0.34,
  },
  [COVER_SHADOW_PRESET.LARGE]: {
    x: 0,
    y: 20,
    blur: 58,
    spread: 0,
    opacity: 0.38,
  },
  [COVER_SHADOW_PRESET.XLARGE]: {
    x: 0,
    y: 30,
    blur: 88,
    spread: 4,
    opacity: 0.42,
  },
}

export const isCoverShadowActive = (shadow: TCoverShadow): boolean =>
  shadow.preset !== COVER_SHADOW_PRESET.NONE && normalizeCoverShadowOpacity(shadow.opacity) > 0

export const normalizeCoverShadowPreset = (
  preset: TCoverShadowPreset | undefined,
): TCoverShadowPreset =>
  preset && preset in SHADOW_PRESET_PARAMS
    ? preset
    : preset === COVER_SHADOW_PRESET.CUSTOM
      ? preset
      : COVER_SHADOW_DEFAULT.PRESET

export const normalizeCoverShadowColorMode = (
  colorMode: TCoverShadowColorMode | undefined,
): TCoverShadowColorMode =>
  colorMode === COVER_SHADOW_COLOR_MODE.WHITE ||
  colorMode === COVER_SHADOW_COLOR_MODE.COLOR ||
  colorMode === COVER_SHADOW_COLOR_MODE.RAINBOW
    ? colorMode
    : COVER_SHADOW_COLOR_MODE.BLACK

export const normalizeCoverShadowHue = (hue: number | undefined): number => {
  const nextHue = getFiniteNumber(hue, COVER_SHADOW_DEFAULT.HUE)

  return Math.round(((nextHue % 360) + 360) % 360)
}

export const normalizeCoverShadowRainbowHue = (hue: number | undefined): number => {
  const nextHue = getFiniteNumber(hue, COVER_SHADOW_DEFAULT.RAINBOW_HUE)

  return Math.round(((nextHue % 360) + 360) % 360)
}

export const normalizeCoverShadowOpacity = (opacity: number | undefined): number =>
  clamp(getFiniteNumber(opacity, COVER_SHADOW_DEFAULT.OPACITY), 0, 1)

export const normalizeCoverShadow = (shadow: TCoverShadow | number | undefined): TCoverShadow => {
  if (typeof shadow === 'number') {
    const preset =
      shadow <= 0
        ? COVER_SHADOW_PRESET.NONE
        : shadow < 20
          ? COVER_SHADOW_PRESET.XSMALL
          : shadow < 40
            ? COVER_SHADOW_PRESET.SMALL
            : shadow < 60
              ? COVER_SHADOW_PRESET.MEDIUM
              : shadow < 80
                ? COVER_SHADOW_PRESET.LARGE
                : COVER_SHADOW_PRESET.XLARGE

    return {
      preset,
      colorMode: COVER_SHADOW_DEFAULT.COLOR_MODE,
      hue: COVER_SHADOW_DEFAULT.HUE,
      rainbowHue: COVER_SHADOW_DEFAULT.RAINBOW_HUE,
      ...SHADOW_PRESET_PARAMS[preset],
    }
  }

  const preset = normalizeCoverShadowPreset(shadow?.preset)

  return {
    preset,
    colorMode: normalizeCoverShadowColorMode(shadow?.colorMode),
    hue: normalizeCoverShadowHue(shadow?.hue),
    rainbowHue: normalizeCoverShadowRainbowHue(shadow?.rainbowHue),
    x: clamp(
      getFiniteNumber(shadow?.x, COVER_SHADOW_DEFAULT.X),
      COVER_SHADOW_RANGE.X.MIN,
      COVER_SHADOW_RANGE.X.MAX,
    ),
    y: clamp(
      getFiniteNumber(shadow?.y, COVER_SHADOW_DEFAULT.Y),
      COVER_SHADOW_RANGE.Y.MIN,
      COVER_SHADOW_RANGE.Y.MAX,
    ),
    blur: clamp(
      getFiniteNumber(shadow?.blur, COVER_SHADOW_DEFAULT.BLUR),
      COVER_SHADOW_RANGE.BLUR.MIN,
      COVER_SHADOW_RANGE.BLUR.MAX,
    ),
    spread: clamp(
      getFiniteNumber(shadow?.spread, COVER_SHADOW_DEFAULT.SPREAD),
      COVER_SHADOW_RANGE.SPREAD.MIN,
      COVER_SHADOW_RANGE.SPREAD.MAX,
    ),
    opacity: normalizeCoverShadowOpacity(shadow?.opacity),
  }
}

const getShadowColor = (shadow: TCoverShadow, opacity: number): string => {
  switch (normalizeCoverShadowColorMode(shadow.colorMode)) {
    case COVER_SHADOW_COLOR_MODE.WHITE:
      return `rgba(255, 255, 255, ${formatAlpha(opacity)})`
    case COVER_SHADOW_COLOR_MODE.COLOR:
      return `hsla(${normalizeCoverShadowHue(shadow.hue)}, 82%, 58%, ${formatAlpha(opacity)})`
    default:
      return `rgba(0, 0, 0, ${formatAlpha(opacity)})`
  }
}

const getShadowLayer = (params: TShadowCssParams, color: string): string =>
  `${color} ${Math.round(params.x)}px ${Math.round(params.y)}px ${Math.round(
    params.blur,
  )}px ${Math.round(params.spread)}px`

const getRainbowShadow = (params: TShadowCssParams, rainbowHue: number): string =>
  [0, 118, 224]
    .map((hue, index) =>
      getShadowLayer(
        {
          ...params,
          x: params.x + (index - 1) * 5,
          y: params.y + index * 2,
          blur: params.blur + index * 8,
          opacity: params.opacity * 0.72,
        },
        `hsla(${normalizeCoverShadowRainbowHue(hue + rainbowHue)}, 92%, 64%, ${formatAlpha(
          params.opacity * 0.46,
        )})`,
      ),
    )
    .join(', ')

export const getImageShadow = (shadow: TCoverShadow | number | undefined): string | undefined => {
  const normalizedShadow = normalizeCoverShadow(shadow)
  const params =
    normalizedShadow.preset === COVER_SHADOW_PRESET.CUSTOM
      ? normalizedShadow
      : SHADOW_PRESET_PARAMS[normalizedShadow.preset]

  if (params.opacity <= 0 || params.blur <= 0) return undefined

  if (normalizedShadow.colorMode === COVER_SHADOW_COLOR_MODE.RAINBOW) {
    return getRainbowShadow(params, normalizedShadow.rainbowHue)
  }

  const mainColor = getShadowColor(normalizedShadow, params.opacity)
  const ambientColor = getShadowColor(normalizedShadow, params.opacity * 0.48)

  return [
    getShadowLayer(params, mainColor),
    getShadowLayer(
      {
        ...params,
        x: params.x * 0.45,
        y: params.y * 1.35,
        blur: params.blur * 1.55,
        spread: params.spread + 4,
        opacity: params.opacity * 0.48,
      },
      ambientColor,
    ),
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
