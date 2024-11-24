import { BANNER_LAYOUT } from '~/const/layout'

import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, fill, cutRest } = useTwBelt()
  const { bannerLayout } = useLayout()

  return {
    preview: cn('row-center w-72 mb-2.5 mt-4 group'),
    brand: cn('row-center px-1.5 py-0.5 rounded mr-2', bg('hoverBg')),
    favicon: 'size-4 mr-1.5',
    siteName: cn('text-xs break-keep', fg('text.digest')),
    //
    title: cn(
      'text-sm no-underline hover:underline',
      `hover:${fg('text.title')}`,
      bannerLayout === BANNER_LAYOUT.SIDEBAR ? cutRest('w-44') : cutRest('w-28'),
      fg('text.digest'),
    ),
    //
    arrowBox: cn('size-3.5 group-smoky-0'),
    arrowIcon: cn('size-3.5', fill('text.digest')),
  }
}
