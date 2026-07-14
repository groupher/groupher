import { COLOR } from '~/const/colors'
import { MARKER } from '~/const/marker'
import THEME from '~/const/theme'
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

export const APPEARANCE_CHANNEL = {
  COLOR: 'color',
  BG: 'bg',
} as const

export const APPEARANCE_COLORS = [
  COLOR.BLACK,
  COLOR.PINK,
  COLOR.RED,
  COLOR.ORANGE,
  COLOR.YELLOW,
  COLOR.BROWN,
  COLOR.GREEN,
  COLOR.CYAN,
  COLOR.BLUE,
  COLOR.PURPLE,
] as const

export const MARKER_POPOVER_SURFACE_COLOR = {
  [THEME.LIGHT]: '#fafafa',
  [THEME.DARK]: '#2e2e2e',
} as const

export const CHECK_COLOR = {
  BLACK: '#000000',
  WHITE: '#ffffff',
} as const
