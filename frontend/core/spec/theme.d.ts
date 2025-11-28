import type ColorTypes from '~/tailwind/tokens/color.type'
import type DayTheme from '~/utils/themes/skins/light'
import type { TFlattenObjectKeys } from './enhance'

export type TThemeName = 'light' | 'dark'
export type TThemeMode = TThemeName | 'system'

// export type TTheme = ((obj: any) => unknown) | string
export type TTheme = string
// export type TTheme = string

export type TThemeMap = typeof DayTheme

// see https://www.raygesualdo.com/posts/flattening-object-keys-with-typescript-types
export type TFlatThemeKey = TFlattenObjectKeys<typeof ColorTypes>
