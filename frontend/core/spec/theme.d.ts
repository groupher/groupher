import type THEME from '~/const/theme'
import type { THEME_MODE } from '~/const/theme'
import type { TConstValues } from '~/spec'
import type TColorTypes from '~/tailwind/tokens/color.type'
import type DayTheme from '~/utils/themes/skins/light'
import type { TFlattenObjectKeys } from './enhance'

export type TThemeName = TConstValues<typeof THEME>
export type TThemeMode = TConstValues<typeof THEME_MODE>

// export type TTheme = ((obj: any) => unknown) | string
export type TTheme = string
// export type TTheme = string

export type TThemeMap = typeof DayTheme

// see https://www.raygesualdo.com/posts/flattening-object-keys-with-typescript-types
export type TFlatThemeKey = TFlattenObjectKeys<typeof TColorTypes>
