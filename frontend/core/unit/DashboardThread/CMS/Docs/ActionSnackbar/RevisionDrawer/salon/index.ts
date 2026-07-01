import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, fill, br, bg, hover, rainbow } = useTwBelt()

  return {
    wrapper: 'column h-full',
    header: 'row-center h-16 shrink-0 px-5',
    titleGroup: 'min-w-0 flex-1',
    title: cn('text-base bold-sm', fg('title')),
    subtitle: cn('mt-0.5 truncate text-xs', fg('hint')),
    closeButton: cn('align-both size-8 rounded-lg button-reset', hover('box')),
    closeIcon: cn('size-3.5', fill('digest'), hover('icon')),
    body: 'min-h-0 flex-1 overflow-y-auto px-4 py-3',
    tabs: 'mb-3',
    tabControl: 'w-full',
    tabItem: 'flex-1',
    list: 'column gap-2',
    currentChangesCard: cn(
      'mb-3 flex w-full min-w-0 flex-col overflow-hidden rounded-lg border px-3 py-2.5',
      br('divider'),
      bg('card'),
    ),
    currentChangesCardActive: rainbow(COLOR.ORANGE, 'border'),
    currentChangesButton: cn('block w-full min-w-0 text-left button-reset', fg('title')),
    currentChangesSummary: cn('row-center gap-2 text-sm bold-sm', fg('title')),
    additions: rainbow(COLOR.GREEN, 'fg'),
    deletions: rainbow(COLOR.RED, 'fg'),
    inlineDiff: 'mt-3 -mx-3 w-auto min-w-0 overflow-hidden self-stretch',
    stateBox: cn('align-both min-h-80 text-sm', fg('hint')),
    errorBox: cn('align-both min-h-80 text-sm', rainbow(COLOR.RED, 'fg')),
    restoreHint: cn(
      'mb-3 rounded-md border px-3 py-2 text-xs',
      br('divider'),
      bg('hoverBg'),
      fg('digest'),
    ),
    hiddenNote: cn('mt-3 text-center text-xs', fg('hint')),
  }
}
