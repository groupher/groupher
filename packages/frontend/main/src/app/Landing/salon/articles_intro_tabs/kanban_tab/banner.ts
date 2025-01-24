import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, fill, rainbow } = useTwBelt()

  return {
    wrapper: cn('column-align-both w-full grow'),
    inner: 'column w-10/12 pt-6 px-5 h-full',
    header: 'row-center',
    title: cn('text-sm bold-sm ml-1', fg('text.digest')),
    titleActrive: rainbow(COLOR_NAME.BLUE, 'fg'),
    //
    labelBar: 'relative grow w-full mb-2.5',
    item: 'absolute row-center',
    label: cn('text-xs ml-1', fg('text.digest')),

    icon: cn('size-3', fill('text.digest')),
  }
}
