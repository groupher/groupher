import type { TColorName } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'
import { COLOR_NAME } from '~/const/colors'

import type { TSubMenu } from '../../spec'
import { getSubMenuWidth } from '../metric'

export { cn } from '~/css'

type TProps = {
  subMenuType?: TSubMenu
  color?: TColorName
}

export default ({ subMenuType = null, color = COLOR_NAME.BLACK }: TProps = {}) => {
  const { cn, fg, bg, menu, fill, cutRest, sexyHBorder, rainbow } = useTwBelt()

  return {
    wrapper: cn(menu('bg'), 'p-2 pr-1 trans-all-200', getSubMenuWidth(subMenuType)),
    menuItem: cn(
      menu('bar'),
      'row-center h-8 w-full px-2 py-0.5 pr-0 rounded-md group',
      fg('text.digest'),
    ),
    menuItemDanger: cn(
      fg('text.digest'),
      `hover:${fg('rainbow.red')}`,
      `hover:${bg('rainbow.redSoft')}`,
    ),
    menuTitle: cn(menu('title'), cutRest('w-24')),
    divider: cn(sexyHBorder(35), 'my-2.5'),
    //
    icon: cn('size-3.5 mr-1.5', fill('text.digest'), `group-hover:${fill('text.title')}`),
    rainbowFill: rainbow(color, 'fill'),
  }
}
