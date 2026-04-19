import { COLOR } from '~/const/colors'
import THEME from '~/const/theme'
import type { TColorName } from '~/spec'

/* eslint-disable radix */
/**
 * for lighten / darken color
 * see https://stackoverflow.com/a/13532993/4050784
 */
const shadeColor = (color: string, percent: number): string => {
  let R = Number.parseInt(color.substring(1, 3), 16)
  let G = Number.parseInt(color.substring(3, 5), 16)
  let B = Number.parseInt(color.substring(5, 7), 16)

  // @ts-expect-error
  R = Number.parseInt((R * (100 + percent)) / 100, 10)
  // @ts-expect-error
  G = Number.parseInt((G * (100 + percent)) / 100, 10)
  // @ts-expect-error
  B = Number.parseInt((B * (100 + percent)) / 100, 10)

  R = R < 255 ? R : 255
  G = G < 255 ? G : 255
  B = B < 255 ? B : 255

  const RR = R.toString(16).length === 1 ? `0${R.toString(16)}` : R.toString(16)
  const GG = G.toString(16).length === 1 ? `0${G.toString(16)}` : G.toString(16)
  const BB = B.toString(16).length === 1 ? `0${B.toString(16)}` : B.toString(16)

  return `#${RR}${GG}${BB}`
}

export const lighten = (color: string, percent: number): string => {
  return shadeColor(color, percent as number)
}

export const darken = (color: string, percent: number): string => {
  return shadeColor(color, -percent as number)
}

export const PAGE_CUSTOM_HUE_DEFAULT = 190
export const PAGE_CUSTOM_INTENSITY_DEFAULT = 100

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value))
}

const expandHex = (hex: string): string | null => {
  const value = hex.trim()

  if (/^#([a-f\d]{3})$/i.test(value)) {
    return value.replace(/^#([a-f\d])([a-f\d])([a-f\d])$/i, (_m, r, g, b) => {
      return `#${r}${r}${g}${g}${b}${b}`
    })
  }

  if (/^#([a-f\d]{6})$/i.test(value)) {
    return value
  }

  return null
}

const hexToRgb = (hex: string): [number, number, number] | null => {
  const normalized = expandHex(hex)
  if (!normalized) return null

  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ]
}

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255

  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const lightness = (max + min) / 2
  const delta = max - min

  if (delta === 0) {
    return [0, 0, lightness * 100]
  }

  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)

  let hue = 0
  switch (max) {
    case rn:
      hue = ((gn - bn) / delta + (gn < bn ? 6 : 0)) * 60
      break
    case gn:
      hue = ((bn - rn) / delta + 2) * 60
      break
    default:
      hue = ((rn - gn) / delta + 4) * 60
      break
  }

  return [hue, saturation * 100, lightness * 100]
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

export const getHueFromHexColor = (hex: string, fallback = PAGE_CUSTOM_HUE_DEFAULT): number => {
  const rgb = hexToRgb(hex)
  if (!rgb) return fallback

  const [hue, saturation] = rgbToHsl(...rgb)
  if (saturation < 1) return fallback
  return Math.round(hue)
}

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

export const getPageBgCustomParamsFromHex = (
  hex: string,
  theme: string,
): { hue: number; intensity: number } => {
  const rgb = hexToRgb(hex)
  if (!rgb) {
    return {
      hue: PAGE_CUSTOM_HUE_DEFAULT,
      intensity: PAGE_CUSTOM_INTENSITY_DEFAULT,
    }
  }

  const [hue] = rgbToHsl(...rgb)
  const safeHue = Math.round(hue)
  let bestIntensity = 100
  let bestDistance = Number.POSITIVE_INFINITY

  for (let intensity = 0; intensity <= 100; intensity += 1) {
    const next = getPageBgCustomColor(theme, safeHue, intensity)
    const nextRgb = hexToRgb(next)
    if (!nextRgb) continue

    const distance =
      (rgb[0] - nextRgb[0]) ** 2 + (rgb[1] - nextRgb[1]) ** 2 + (rgb[2] - nextRgb[2]) ** 2

    if (distance < bestDistance) {
      bestDistance = distance
      bestIntensity = intensity
    }
  }

  return {
    hue: safeHue,
    intensity: bestIntensity,
  }
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
