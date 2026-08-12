import useTwBelt from '~/hooks/useTwBelt'

import { DSB_DOC } from '../../constant'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, hover, primary, vividDark } = useTwBelt()

  return {
    wrapper: cn('column w-full', fg('digest')),
    header: cn('row-center justify-between', DSB_DOC.HEADER_ROW),
    collapseToggle: cn(
      'align-both size-6 rounded-md border border-transparent trans-all-100 pointer',
      'smoky-65',
      hover('bg'),
    ),
    collapseIcon: 'size-3.5',
    menu: cn(
      'column gap-1 ml-1.5 border-l border-transparent sexy-border-50',
      DSB_DOC.SIDE_MENU.EXPANDED_BODY_TOP,
    ),
    item: cn(
      'row-center relative w-full overflow-hidden rounded-lg py-1 pr-3 pl-5 text-sm no-underline',
      `hover:${bg('hoverBg')}`,
      fg('digest'),
    ),
    itemActive: cn('py-1.5 bold-sm', primary('fg'), vividDark()),
    itemActiveBg: cn('absolute inset-0 rounded-lg rounded-tl-none rounded-bl-none', bg('hoverBg')),
    itemActiveBar: cn('absolute -left-0.5 top-2 w-1 h-4 rounded opacity-80', primary('bg')),
    itemLabel: 'relative z-10 min-w-0',
    itemEnd: 'relative z-10 ml-auto shrink-0 pl-3',
  }
}
