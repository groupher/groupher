import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, rainbow } = useTwBelt()

  return {
    wrapper: cn('relative align-both gap-x-4 py-12'),
    seedIcon: cn('size-4 absolute opacity-65', rainbow(COLOR_NAME.GREEN, 'fill')),
    dashline: cn('w-14 h-1 border-t border-dashed opacity-30', rainbow(COLOR_NAME.BLACK, 'border')),
    connectline: cn(
      'w-14 h-1 border-t border-dashed opacity-50 -ml-4 mt-0.5',
      rainbow(COLOR_NAME.RED, 'border'),
    ),
  }
}
