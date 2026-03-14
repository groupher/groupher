import { COLOR } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, fill, rainbow } = useTwBelt()

  return {
    wrapper: 'column-align-both w-full grow',
    inner: 'column w-10/12 pt-6 px-5 h-full',
    header: 'row-center',
    title: cn('text-sm bold-sm ml-1', fg('digest')),
    titleActrive: rainbow(COLOR.BLUE, 'fg'),
    //
    labelBar: 'relative grow w-full mb-2.5',
    item: 'absolute row-center',
    label: cn('text-xs ml-1', fg('digest')),

    icon: cn('size-3', fill('digest')),
  }
}
