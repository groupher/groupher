import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

import { getSubMenuWidth } from '../../salon/metric'
import type { TSubMenu } from '../../spec'

export { cn } from '~/css'

type TProps = {
  subMenuType?: TSubMenu
  color?: TColorName
}

export default function useSalon({ subMenuType = null, color = COLOR.BLACK }: TProps = {}) {
  const { cn, fg, bg, menu, cut, sexyBorder, rainbow, hover } = useTwBelt()

  return {
    wrapper: cn(menu('bg'), 'p-2 pr-1 trans-all-200', getSubMenuWidth(subMenuType)),
    menuItem: cn(
      menu('bar'),
      'row-center h-8 w-full px-2 py-0.5 pr-0 rounded-md group',
      fg('digest'),
    ),
    menuItemDanger: cn(
      fg('digest'),
      `hover:${fg('rainbow.red')}`,
      `hover:${bg('rainbow.redSoft')}`,
    ),
    menuTitle: cn(menu('title'), cut('w-24')),
    divider: cn(sexyBorder(), 'my-2.5'),
    //
    icon: cn('size-3.5 mr-1.5', hover('icon')),
    rainbowFill: rainbow(color, 'fill'),
  }
}
