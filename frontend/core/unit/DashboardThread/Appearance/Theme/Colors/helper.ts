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
