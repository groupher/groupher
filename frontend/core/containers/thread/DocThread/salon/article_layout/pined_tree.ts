import { COLOR } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, br, rainbow, fill } = useTwBelt()

  return {
    wrapper: 'column justify-center gap-y-4 w-full mb-9',
    item: 'row-center pointer group shrink-0',
    iconBox: 'align-both size-6 align-center relative mr-3.5',
    cover: 'size-6 absolute left-0 top-0 rounded',
    //
    blackBg: rainbow(COLOR.BLACK, 'bg'),
    purpleBg: rainbow(COLOR.PURPLE, 'bg'),
    grayBg: cn('border', bg('hoverBg'), br('divider')),
    //
    bookIcon: cn('size-4 z-20', fill('digest')),
    normalIcon: cn('size-4 z-20', fill('digest')),
    title: cn('text-sm shrink-0', fg('digest'), `group-hover:${fg('title')}`),
  }
}
