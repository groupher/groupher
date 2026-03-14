import { COLOR } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, menu, fill, br, shadow, rainbow, sexyBorder } = useTwBelt()

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
    icon: cn('size-3.5 mr-1.5', fill('digest')),
    tagIcon: cn('size-3.5 mr-1.5', rainbow(COLOR.BLUE, 'fill')),
    //
    divider: cn('mt-2.5 mb-2.5', sexyBorder()),
  }
}
