import { BANNER_LAYOUT } from '~/const/layout'

import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, fill, cut } = useTwBelt()
  const { globalLayout } = useLayout()

  return {
    preview: 'row-center w-72 mb-2.5 mt-4 -ml-1 group',
    brand: cn('row-center px-1.5 py-0.5 rounded mr-2', bg('hoverBg')),
    favicon: 'size-4 mr-1.5',
    siteName: cn('text-xs break-keep', fg('digest')),
    //
    title: cn(
      'text-sm no-underline hover:underline',
      `hover:${fg('title')}`,
      globalLayout === BANNER_LAYOUT.SIDEBAR ? cut('w-44') : cut('w-28'),
      fg('digest'),
    ),
    //
    arrowBox: 'size-3.5 group-smoky-0',
    arrowIcon: cn('size-3.5', fill('digest')),
  }
}
