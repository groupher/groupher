import { lowerEnumValue, valueKeyedEnum } from '~/lib/enumValues'
import { WallpaperTheme } from '~/lib/graphql/generated/enums'

const themeValues = valueKeyedEnum(WallpaperTheme)

export const THEME_MODE = {
  LIGHT: lowerEnumValue(themeValues.LIGHT),
  DARK: lowerEnumValue(themeValues.DARK),
  SYSTEM: 'system',
} as const

const THEME = {
  LIGHT: THEME_MODE.LIGHT,
  DARK: THEME_MODE.DARK,
} as const

export default THEME

export const THEME_MODE_COOKIE = 'themeMode'
export const THEME_COOKIE_MAX_AGE = 31_536_000
