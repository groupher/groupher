import type { TIconName, TIconProvider } from '~/widgets/IconHub/icons'

export const TAB = {
  ICON: 'icon',
  COLOR: 'color',
  EMOJI: 'emoji',
} as const

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
