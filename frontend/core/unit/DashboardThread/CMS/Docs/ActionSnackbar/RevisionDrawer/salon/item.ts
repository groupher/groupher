import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, br, hover, rainbow } = useTwBelt()

  return {
    item: cn(
      'flex w-full min-w-0 flex-col rounded-lg border px-3 py-2.5',
      br('divider'),
      bg('card'),
      hover('box'),
    ),
    itemSelected: rainbow(COLOR.ORANGE, 'border'),
    selectButton: 'block w-full min-w-0 button-reset text-left',
    summary: cn('row-center gap-2 text-sm bold-sm', fg('title')),
    additions: rainbow(COLOR.GREEN, 'fg'),
    deletions: rainbow(COLOR.RED, 'fg'),
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
