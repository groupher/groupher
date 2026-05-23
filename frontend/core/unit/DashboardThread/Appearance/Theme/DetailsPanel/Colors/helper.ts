import { COLOR, RAINBOW_COLOR_HEX } from '~/const/colors'
import THEME from '~/const/theme'
import type { TColorName } from '~/spec'

export type TThemeMode = typeof THEME.LIGHT | typeof THEME.DARK

export const resolvePresetColor = (color: TColorName, theme: TThemeMode) =>
  RAINBOW_COLOR_HEX[theme][color] ?? RAINBOW_COLOR_HEX[theme][COLOR.BLACK]

export const findPresetColor = (color: string, theme: TThemeMode): TColorName => {
  const match = Object.entries(RAINBOW_COLOR_HEX[theme]).find(([, value]) => value === color)

  return (match?.[0] as TColorName | undefined) ?? COLOR.CUSTOM
}

// Keep swatches visible when the selected color is close to the surrounding
// page/card surface, without changing the color being previewed.
export const getContrastRingColor = (theme: TThemeMode): string => {
  const stroke = theme === THEME.LIGHT ? '0 0 0' : '255 255 255'

  return `rgb(${stroke} / 0.26)`
}

// Used with the contrast ring for near-background color balls such as card color.
export const getContrastBallShadow = (theme: TThemeMode): string => {
  const stroke = theme === THEME.LIGHT ? '0 0 0' : '255 255 255'

  return `inset 0 0 0 1px rgb(${stroke} / 0.2)`
}
