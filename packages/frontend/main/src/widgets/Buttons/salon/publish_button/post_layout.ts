import { BANNER_LAYOUT } from '~/const/layout'

import useTwBelt from '~/hooks/useTwBelt'
import useLayout from '~/hooks/useLayout'

export default () => {
  const { cn, fill } = useTwBelt()
  const { bannerLayout } = useLayout()

  return {
    wrapper: cn(
      'row-center justify-between',
      BANNER_LAYOUT.HEADER === bannerLayout ? 'w-40' : 'w-28',
    ),
    title: cn('text-xs pl-0.5 bold-sm'),
    editIcon: cn('size-3 mr-1 opacity-80', fill('button.fg')),
  }
}
