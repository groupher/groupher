import type { COLOR } from '~/const/colors'
import type { TConstValues } from '~/spec'

export type TColorName = TConstValues<typeof COLOR>

export type TColor = { color?: TColorName; $color?: TColorName }
