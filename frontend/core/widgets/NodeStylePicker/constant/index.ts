import { NODE_STYLE } from '~/const/node_style'
import type { TIconName } from '~/widgets/IconHub/icons'
import type { TIconProvider } from '~/widgets/IconHub/sprite'

export const TAB = NODE_STYLE

export const TAB_ITEMS = [
  {
    title: 'icon',
    slug: TAB.ICON,
  },
  {
    title: 'color',
    slug: TAB.COLOR,
  },
  {
    title: 'emoji',
    slug: TAB.EMOJI,
  },
] as const

export const DEFAULT_PROVIDER: TIconProvider = 'fa'
export const DEFAULT_ICON_NAME: TIconName = 'user'
