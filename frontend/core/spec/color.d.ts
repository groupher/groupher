import type { COLOR_NAME } from '~/const/colors'
import type { TConstValues } from '~/spec'

export type TColorName = TConstValues<typeof COLOR_NAME>

export type TPrimaryColor = { primaryColor: TColorName }
export type TColor = { color?: TColorName; $color?: TColorName }
