import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, fill, bg, br, hover, rainbow } = useTwBelt()

  return {
    item: cn(
      'flex w-full min-w-0 flex-col rounded-lg border px-3 py-2.5',
      br('divider'),
      bg('card'),
      hover('box'),
    ),
    itemSelected: rainbow(COLOR.ORANGE, 'border'),
    selectButton: 'group block min-h-10 w-full min-w-0 button-reset text-left',
    summaryRow: 'row-center min-w-0 justify-between',
    summary: cn('row-center gap-2 text-sm bold-sm', fg('title')),
    toggleIcon: 'align-both size-5 shrink-0 -rotate-90 transition-transform duration-150 ease-out',
    toggleIconExpanded: 'rotate-90',
    toggleIconSvg: cn('size-3', fill('digest'), `group-hover:${fill('title')}`),
    additions: cn('pretty-num', rainbow(COLOR.GREEN, 'fg')),
    deletions: cn('pretty-num', rainbow(COLOR.RED, 'fg')),
    authorLine: cn('mt-1 row-center gap-1.5 text-xs', fg('hint')),
    avatar: 'size-4 shrink-0 rounded-full',
    avatarFallback: cn(
      'align-both size-4 shrink-0 rounded-full text-xxs bold-sm',
      bg('hoverBg'),
      fg('hint'),
    ),
    actions: 'mt-2 row-center w-full justify-end px-3',
    diffSlot: 'mt-3 -mx-3 block w-auto min-w-0 self-stretch',
  }
}
