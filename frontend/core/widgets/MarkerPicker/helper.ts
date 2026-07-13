import {
  COLOR,
  getDefaultCustomColor,
  RAINBOW_COLOR_HEX,
  RAINBOW_SOFT_COLOR_HEX,
} from '~/const/colors'
import { MARKER } from '~/const/marker'
import type {
  TMarkerAppearance,
  TMarkerBgAppearance,
  TMarkerThemeAppearance,
  TMarkerValue,
  TColorName,
  TThemeName,
} from '~/spec'

import { APPEARANCE_CHANNEL, APPEARANCE_COLORS, CHECK_COLOR } from './constant'
import type { TActiveAppearanceValue } from './spec'

export type TAppearanceChannel = (typeof APPEARANCE_CHANNEL)[keyof typeof APPEARANCE_CHANNEL]
export type TAppearanceColor = (typeof APPEARANCE_COLORS)[number]

const emptyAppearance = (): TMarkerAppearance => ({
  light: {},
  dark: {},
})

export const toBgAppearance = (
  appearance?: TMarkerAppearance | TMarkerBgAppearance,
): TMarkerBgAppearance | undefined => {
  if (!appearance) return undefined

  return {
    light: appearance.light.bg ? { bg: appearance.light.bg } : {},
    dark: appearance.dark.bg ? { bg: appearance.dark.bg } : {},
  }
}

export const updateMarkerAppearance = (
  value: TMarkerValue,
  theme: TThemeName,
  channel: TAppearanceChannel,
  hex: string,
): TMarkerValue => {
  const appearance = value.appearance ?? emptyAppearance()
  const nextAppearance = {
    ...appearance,
    [theme]: {
      ...appearance[theme],
      [channel]: hex,
    },
  } as TMarkerAppearance

  if (value.type === MARKER.EMOJI) {
    return {
      ...value,
      appearance: toBgAppearance(nextAppearance),
    }
  }

  return { ...value, appearance: nextAppearance }
}

export const getAppearanceValue = (
  value: TMarkerValue,
  theme: TThemeName,
  channel: TAppearanceChannel,
): string | undefined => value.appearance?.[theme][channel]

export const getPresetHex = (
  theme: TThemeName,
  channel: TAppearanceChannel,
  color: TAppearanceColor,
): string =>
  channel === APPEARANCE_CHANNEL.COLOR
    ? RAINBOW_COLOR_HEX[theme][color]
    : RAINBOW_SOFT_COLOR_HEX[theme][color]

export const findAppearancePreset = (
  hex: string | undefined,
  theme: TThemeName,
  channel: TAppearanceChannel,
): TAppearanceColor | undefined => {
  if (!hex) return undefined

  const normalizedHex = hex.toLowerCase()
  return APPEARANCE_COLORS.find(
    (color) => getPresetHex(theme, channel, color).toLowerCase() === normalizedHex,
  )
}

export const isCustomAppearanceValue = (
  hex: string | undefined,
  theme: TThemeName,
  channel: TAppearanceChannel,
): boolean => Boolean(hex && !findAppearancePreset(hex, theme, channel))

type TAppearanceTriggerStyle = {
  color: string
  bg: string
}

export const getAppearanceTriggerStyle = (
  value: TMarkerValue,
  theme: TThemeName,
): TAppearanceTriggerStyle => ({
  color: getAppearanceValue(value, theme, APPEARANCE_CHANNEL.COLOR) ?? getDefaultCustomColor(theme),
  bg:
    getAppearanceValue(value, theme, APPEARANCE_CHANNEL.BG) ??
    getPresetHex(theme, APPEARANCE_CHANNEL.BG, COLOR.BLACK),
})

type TResolveActiveAppearanceArgs = {
  value: TMarkerValue
  theme: TThemeName
  activeColor?: TActiveAppearanceValue
  activeBg?: TActiveAppearanceValue
}

const resolveActiveAppearanceValue = (
  value: TActiveAppearanceValue | undefined,
  theme: TThemeName,
  channel: TAppearanceChannel,
): string | undefined => {
  if (!value || value === COLOR.CUSTOM) return undefined

  const palette = (
    channel === APPEARANCE_CHANNEL.COLOR ? RAINBOW_COLOR_HEX[theme] : RAINBOW_SOFT_COLOR_HEX[theme]
  ) as Partial<Record<TColorName, string>>

  return palette[value as TColorName] ?? value
}

export const resolveActiveAppearance = ({
  value,
  theme,
  activeColor,
  activeBg,
}: TResolveActiveAppearanceArgs): TMarkerThemeAppearance => {
  const appearance = value.appearance?.[theme]
  const markerColor = value.type === MARKER.ICON ? value.appearance?.[theme].color : undefined

  return {
    color: resolveActiveAppearanceValue(
      activeColor ?? markerColor,
      theme,
      APPEARANCE_CHANNEL.COLOR,
    ),
    bg: resolveActiveAppearanceValue(activeBg ?? appearance?.bg, theme, APPEARANCE_CHANNEL.BG),
  }
}

type TRgba = {
  red: number
  green: number
  blue: number
  alpha: number
}

const HEX_COLOR_PATTERN = /^([0-9a-f]{6}|[0-9a-f]{8})$/i

const parseHexColor = (hex: string): TRgba | null => {
  const raw = hex.replace('#', '')
  const normalized =
    raw.length === 3 || raw.length === 4
      ? raw
          .split('')
          .map((channel) => `${channel}${channel}`)
          .join('')
      : raw

  if (!HEX_COLOR_PATTERN.test(normalized)) return null

  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  const alpha = normalized.length === 8 ? Number.parseInt(normalized.slice(6, 8), 16) / 255 : 1

  if ([red, green, blue, alpha].some(Number.isNaN)) return null

  return { red, green, blue, alpha }
}

const compositeChannel = (foreground: number, background: number, alpha: number): number =>
  foreground * alpha + background * (1 - alpha)

const toLinearChannel = (channel: number): number => {
  const normalized = channel / 255
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

const getRelativeLuminance = (color: TRgba): number =>
  0.2126 * toLinearChannel(color.red) +
  0.7152 * toLinearChannel(color.green) +
  0.0722 * toLinearChannel(color.blue)

export const getReadableCheckColor = (color: string, surfaceColor: string): string => {
  const foreground = parseHexColor(color)
  const surface = parseHexColor(surfaceColor)
  if (!foreground || !surface) return CHECK_COLOR.WHITE

  const composited = {
    red: compositeChannel(foreground.red, surface.red, foreground.alpha),
    green: compositeChannel(foreground.green, surface.green, foreground.alpha),
    blue: compositeChannel(foreground.blue, surface.blue, foreground.alpha),
    alpha: 1,
  }
  const luminance = getRelativeLuminance(composited)
  const blackContrast = (luminance + 0.05) / 0.05
  const whiteContrast = 1.05 / (luminance + 0.05)

  return blackContrast >= whiteContrast ? CHECK_COLOR.BLACK : CHECK_COLOR.WHITE
}

export const getCustomColorFallback = (
  appearance: TMarkerThemeAppearance | undefined,
  theme: TThemeName,
  channel: TAppearanceChannel,
): string => {
  const current = appearance?.[channel]
  if (current) return current

  if (channel === APPEARANCE_CHANNEL.BG) {
    return RAINBOW_SOFT_COLOR_HEX[theme][COLOR.BLUE]
  }

  return getDefaultCustomColor(theme)
}
