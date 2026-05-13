import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, rainbow, br, primary } = useTwBelt()

  return {
    wrapper: 'column w-full gap-y-6 relative',
    group: 'w-full',
    groupTitle: cn('text-sm bold mb-2', fg('title')),
    primaryGroupTitle: cn('text-sm bold mb-2', primary('fg')),
    groupPanel: cn('w-full rounded-sm border', br('divider')),
    groupBody: 'grid grid-cols-2 gap-x-5 gap-y-1',
    threadedGroupBody: 'column w-full gap-y-5 p-4',
    threadGroup: 'min-w-0 w-full',
    threadTitle: cn('row-center text-xs bold-sm uppercase mb-3 gap-x-1.5', fg('title')),
    primaryThreadTitle: cn('row-center text-xs bold-sm uppercase mb-3 gap-x-1.5', primary('fg')),
    threadCount: cn('normal-case font-normal', fg('digest')),
    primaryThreadCount: cn('normal-case font-normal', primary('fg')),
    threadRules: 'grid grid-cols-2 gap-x-5 gap-y-1',
    item: 'row-center min-w-0 w-full overflow-hidden',
    readonlyItem: 'row-center w-1/2',
    checkIcon: cn('size-3 mr-1.5', rainbow(COLOR.GREEN, 'fill')),
    rootCheckIcon: cn('size-3 mr-1.5', rainbow(COLOR.GREEN, 'fill')),
    itemTitle: cn('text-sm ml-2 min-w-0 flex-1 truncate', fg('digest')),
    primaryItemTitle: cn('text-sm ml-2 min-w-0 flex-1 truncate', primary('fg')),
  }
}
