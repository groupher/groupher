import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, menu, fill, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'row-center absolute -left-3 -top-4 w-24 h-7 px-1 z-20 trans-all-200 rounded-md gap-x-1.5',
      'scale-0 group-hover:scale-100',
      menu('bg'),
      shadow('md'),
    ),
    hover: '-top-1.5',
    //
    item: 'align-both size-4',
    itemActive: cn('rounded-md', rainbow(COLOR_NAME.CYAN, 'bgSoft')),
    icon: cn('size-3.5', fill('text.digest')),
    iconActive: rainbow(COLOR_NAME.CYAN, 'fill'),
  }
}
