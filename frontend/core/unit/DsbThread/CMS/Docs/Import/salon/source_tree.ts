import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

/** Returns presentation classes for selectable TargetTree nodes. */
export default function useSalon() {
  const { cn, bg, fg, rainbow, sexyVBorder } = useTwBelt()

  return {
    wrapper: cn('max-h-96 overflow-y-auto rounded-xl p-2', bg('sandBox')),
    tab: cn('rounded-lg px-3 py-2', bg('card')),
    tabTitle: cn('text-sm font-semibold', fg('title')),
    selectionControl: 'min-h-10 w-full',
    group: 'ml-4 mt-2',
    groupHeader: 'row-center gap-4',
    groupSelection: 'min-h-10 min-w-0 flex-1',
    groupTitle: cn('text-xs font-medium', fg('digest')),
    groupChildren: 'relative ml-2 pl-4',
    groupDivider: cn(sexyVBorder(35), 'absolute inset-y-0 left-0 -translate-x-1/2'),
    page: cn('flex min-h-10 items-center justify-between gap-4 text-sm', fg('title')),
    pageSelection: 'min-h-10 min-w-0 flex-1',
    linkRow: 'flex min-h-10 min-w-0 flex-1 items-center gap-2',
    pageTitle: 'truncate',
    pageMeta: 'row-center shrink-0 gap-2 text-xs tabular-nums',
    metaDot: fg('hint'),
    fileSize: cn('text-right text-xs', fg('digest')),
    unlistedStatus: cn('shrink-0', rainbow(COLOR.ORANGE, 'fg')),
    draftStatus: cn('shrink-0', fg('link')),
  }
}
