import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, fill, br, bg, hover, rainbow } = useTwBelt()

  return {
    wrapper: 'column h-full',
    header: cn('row-center h-16 shrink-0 border-b px-5', br('divider')),
    titleGroup: 'min-w-0 flex-1',
    title: cn('text-base bold-sm', fg('title')),
    subtitle: cn('mt-0.5 truncate text-xs', fg('hint')),
    closeButton: cn('align-both size-8 rounded-lg button-reset', hover('box')),
    closeIcon: cn('size-3.5', fill('digest'), hover('icon')),
    body: 'min-h-0 flex-1 overflow-y-auto px-4 py-3',
    tabs: cn('mb-3 grid grid-cols-2 rounded-lg border p-0.5', br('divider'), bg('card')),
    tabButton: cn('h-8 rounded-md button-reset text-xs bold-sm', fg('digest'), hover('box')),
    tabButtonActive: cn(bg('hoverBg'), fg('title')),
    list: 'column gap-2',
    currentChangesButton: cn(
      'mb-2 flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left text-sm bold-sm button-reset',
      br('divider'),
      bg('card'),
      fg('title'),
      hover('box'),
    ),
    currentChangesButtonActive: cn(rainbow(COLOR.ORANGE, 'border'), bg('hoverBg')),
    currentChangesMeta: 'row-center shrink-0 gap-2 text-xs',
    additions: rainbow(COLOR.GREEN, 'fg'),
    deletions: rainbow(COLOR.RED, 'fg'),
    currentChangesHint: cn('shrink-0 text-xs normal', fg('hint')),
    inlineDiff: cn('mb-3 overflow-hidden rounded-lg border', br('divider'), bg('card')),
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
