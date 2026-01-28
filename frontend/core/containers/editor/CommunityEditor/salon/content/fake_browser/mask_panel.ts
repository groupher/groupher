import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, rainbow, sexyBorder } = useTwBelt()

  return {
    wrapper: cn('absolute left-0 -bottom-10 pt-16 w-[678px] h-48 px-24 hidden-panel'),
    item: cn('row-center mb-2', fg('digest')),
    inner: 'row wrap gap-y-2',
    dot: cn('size-1 circle mr-2', bg('text.digest')),
    //
    checkIcon: cn('size-4 mr-2', rainbow(COLOR_NAME.GREEN, 'fill')),
    header: 'column-align-both w-full mb-8',
    divider: cn(sexyBorder(), 'w-40 h-0.5 mt-4 mb-3'),
  }
}
