import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

import type { TToastType } from '../spec'

export default function useSalon() {
  const { bg, br, cn, fg, rainbow, rainbowSoft, zIndex } = useTwBelt()

  const iconBox = (type: TToastType): string => {
    switch (type) {
      case 'success':
        return cn(rainbowSoft(COLOR.GREEN), rainbow(COLOR.GREEN, 'fg'))
      case 'error':
        return cn(rainbowSoft(COLOR.RED), rainbow(COLOR.RED, 'fg'))
      default:
        return cn(rainbowSoft(COLOR.BLUE), rainbow(COLOR.BLUE, 'fg'))
    }
  }

  return {
    wrapper: cn(
      'pointer-events-none fixed inset-x-0 top-5 column-center gap-2 px-4',
      zIndex('tooltip'),
    ),
    item: cn(
      'row-center group pointer-events-auto w-fit max-w-md rounded-md border px-3 py-2',
      'shadow-modal backdrop-blur-md',
      bg('popover.bg'),
      br('divider'),
    ),
    iconBox: (type: TToastType) =>
      cn('align-both mr-2 size-5 shrink-0 circle text-xs bold-sm', iconBox(type)),
    message: cn('min-w-0 break-words text-sm leading-5', fg('title')),
    close: cn(
      'align-both relative ml-3 size-5 shrink-0 rounded opacity-45 trans-all-100',
      'hover:opacity-100',
      `hover:${bg('hoverBg')}`,
    ),
    closeLine: cn('absolute h-px w-2.5 rotate-45 rounded-full', bg('digest')),
    closeLineInvert: cn('absolute h-px w-2.5 -rotate-45 rounded-full', bg('digest')),
    icon: 'size-2.5',
  }
}
