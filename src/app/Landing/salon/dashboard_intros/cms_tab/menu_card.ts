import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, menu, fill, br, shadow, rainbow, sexyHBorder } = useTwBelt()

  return {
    wrapper: cn(
      'column px-1 py-2 border w-40 h-[360px] z-30 rounded-lg',
      'absolute -right-10 bottom-24 mb-2',
      menu('bg'),
      br('divider'),
      shadow('xl'),
    ),
    menuItem: cn(menu('bar'), 'px-1'),
    menuTitle: cn(menu('title')),
    icon: cn('size-3.5 mr-1.5', fill('text.digest')),
    tagIcon: cn('size-3.5 mr-1.5', rainbow(COLOR_NAME.BLUE, 'fill')),
    //
    divider: cn('mt-2.5 mb-2.5', sexyHBorder(35)),
  }
}
