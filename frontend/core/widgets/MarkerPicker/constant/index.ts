import { MARKER } from '~/const/marker'
import type { TIconName } from '~/widgets/IconHub/icons'
import type { TIconProvider } from '~/widgets/IconHub/sprite'

export const TAB = MARKER

export const TAB_ITEMS = [
  {
    title: 'icon',
    slug: TAB.ICON,
  },
  {
    title: 'emoji',
    slug: TAB.EMOJI,
  },
] as const

export const DEFAULT_PROVIDER: TIconProvider = 'fa'
export const DEFAULT_ICON_NAME: TIconName = 'user'
