import { COLOR, RAINBOW_COLOR_HEX } from '~/const/colors'
import THEME from '~/const/theme'
import type { TColorName } from '~/spec'

export const PAGE_CUSTOM_HUE_DEFAULT = 190
export const PAGE_CUSTOM_INTENSITY_DEFAULT = 100

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value))
}

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp(s, 0, 100) / 100
  const light = clamp(l, 0, 100) / 100

  if (sat === 0) {
    const value = Math.round(light * 255)
    return [value, value, value]
  }

  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat
  const p = 2 * light - q
  const hk = hue / 360

  const toChannel = (t: number) => {
    let value = t
    if (value < 0) value += 1
    if (value > 1) value -= 1
    if (value < 1 / 6) return p + (q - p) * 6 * value
    if (value < 1 / 2) return q
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6
    return p
  }

  return [
    Math.round(toChannel(hk + 1 / 3) * 255),
    Math.round(toChannel(hk) * 255),
    Math.round(toChannel(hk - 1 / 3) * 255),
  ]
}

const rgbToHex = (r: number, g: number, b: number): string => {
  return `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`
}

const mixRgb = (
  base: [number, number, number],
  tint: [number, number, number],
  ratio: number,
): [number, number, number] => {
  const mixRatio = clamp(ratio, 0, 1)

  return [
    Math.round(base[0] * (1 - mixRatio) + tint[0] * mixRatio),
    Math.round(base[1] * (1 - mixRatio) + tint[1] * mixRatio),
    Math.round(base[2] * (1 - mixRatio) + tint[2] * mixRatio),
  ]
}

const getLightPageBgTintRatio = (intensity: number): number => {
  const strength = normalizePageBgIntensity(intensity) / 100
  return 0.02 + strength * 0.12
}

const getDarkPageBgTintRatio = (intensity: number): number => {
  const strength = normalizePageBgIntensity(intensity) / 100
  return 0.08 + strength * 0.24
}

export const normalizePageBgHue = (value?: number | null): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return PAGE_CUSTOM_HUE_DEFAULT
  }

  return clamp(value, 0, 360)
}

export const normalizePageBgIntensity = (value?: number | null): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return PAGE_CUSTOM_INTENSITY_DEFAULT
  }

  return clamp(value, 0, 100)
}

/**
 * Map a preset color token to an actual hex color in the target theme.
 *
 * This is the shared palette resolver for wallpaper and theme flows. It accepts a
 * `TColorName` and theme key, then falls back to `COLOR.BLACK` when the token
 * is missing in the target palette.
 *
 * @example
 * mapToPresetColorHex(COLOR.PINK, THEME.LIGHT)
 * // => '#FBEFDE'
 */
export const mapToPresetColorHex = (
  color: TColorName,
  theme: keyof typeof RAINBOW_COLOR_HEX,
): string => RAINBOW_COLOR_HEX[theme][color] ?? RAINBOW_COLOR_HEX[theme][COLOR.BLACK]

export const getPageBgCustomColor = (
  theme: string,
  hue?: number | null,
  intensity?: number | null,
): string => {
  const safeHue = normalizePageBgHue(hue)
  const safeIntensity = normalizePageBgIntensity(intensity)
  const tintColor = theme === THEME.DARK ? hslToRgb(safeHue, 78, 58) : hslToRgb(safeHue, 88, 64)

  if (theme === THEME.DARK) {
    const mixed = mixRgb([12, 16, 24], tintColor, getDarkPageBgTintRatio(safeIntensity))
    return rgbToHex(...mixed)
  }

  const mixed = mixRgb([255, 255, 255], tintColor, getLightPageBgTintRatio(safeIntensity))
  return rgbToHex(...mixed)
}

export const getLetterColor = (username: string): TColorName => {
  const firstLetter = username[0].toLowerCase()

  switch (firstLetter) {
    case 'a':
    case 'b':
    case 'c': {
      return COLOR.RED
    }

    case 'd':
    case 'e':
    case 'f': {
      return COLOR.YELLOW
    }

    case 'g':
    case 'h':
    case 'i': {
      return COLOR.GREEN
    }

    case 'j':
    case 'k':
    case 'l': {
      return COLOR.BLUE
    }

    case 'm':
    case 'n':
    case 'o': {
      return COLOR.PURPLE
    }

    case 'p':
    case 'q':
    case 'r': {
      return COLOR.CYAN
    }
    case 's':
    case 't':
    case 'w':
    case 'u': {
      return COLOR.PURPLE
    }

    case 'x':
    case 'y':
    case 'z': {
      return COLOR.CYAN
    }

    default: {
      return COLOR.PURPLE
    }
  }
}
