import { COLOR } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: 'row wrap mt-16 pl-8 w-full h-72',
    item: 'row-center w-1/2 h-4 gap-x-2 trans-all-200',
    title: cn('text-sm', fg('digest')),

    checkIcon: cn('size-3.5', rainbow(COLOR.PINK, 'fill')),
    holderItem: 'row-center w-1/2 h-4',
    holderBar: cn('w-20 h-2 rounded-md ml-2.5 opacity-20', rainbow(COLOR.RED, 'bg')),
  }
}
