import MENU from '~/const/menu'
import { COLOR_NAME } from '~/const/colors'

import ArrowSVG from '~/icons/Arrow'
import Arrow2TopSVG from '~/icons/Arrow2Top'
import SettingSVG from '~/icons/Setting'
import DeleteSVG from '~/icons/Trash'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, menu, fill, rainbow } = useTwBelt()

  return {
    wrapper: cn(menu('bar'), 'row-center-between px-1 py-1'),
    title: cn(menu('title'), 'text-xs'),
    deleteTitle: cn(
      menu('title'),
      'text-xs',
      `group-hover/menubar:${rainbow(COLOR_NAME.RED, 'fg')}`,
    ),

    ARROW_RIGHT: 'size-2.5 ml-0.5 rotate-180',
    ARROW_LEFT: 'size-2.5 ml-0.5',
    ARROW_TO_BOTTOM: 'rotate-180',
    DELETE: `group-hover/menubar:${rainbow(COLOR_NAME.RED, 'fill')}`,
    icon: cn('size-3.5', fill('text.digest')),
  }
}

export const MenuIcon = {
  [MENU.ARROW_LEFT]: ArrowSVG,
  [MENU.ARROW_TO_LEFT]: Arrow2TopSVG,
  [MENU.ARROW_RIGHT]: ArrowSVG,
  [MENU.ARROW_TO_RIGHT]: Arrow2TopSVG, // TODO

  [MENU.ARROW_UP]: ArrowSVG,
  [MENU.ARROW_DOWN]: ArrowSVG,

  [MENU.ARROW_TO_TOP]: Arrow2TopSVG,
  [MENU.ARROW_TO_BOTTOM]: Arrow2TopSVG,
  [MENU.SETTING]: SettingSVG,
  [MENU.DELETE]: DeleteSVG,
}
