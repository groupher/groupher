import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, rainbow, br, primary } = useTwBelt()

  return {
    wrapper: 'column w-full gap-y-6 relative',
    group: 'w-full',
    groupHeader: 'mb-2 ml-0.5',
    groupTitle: cn('text-sm bold', fg('title')),
    primaryGroupTitle: cn('text-sm bold', primary('fg')),
    groupDesc: cn('text-sm mt-1 mb-3 w-11/12', fg('digest')),
    groupPanel: cn('w-full rounded-sm border', br('divider')),
    groupBody: 'grid grid-cols-2 gap-x-5 gap-y-1',
    threadedGroupBody: 'column w-full gap-y-5 py-3.5 pl-3 pr-0',
    threadGroup: 'min-w-0 w-full',
    threadTitle: cn('row-center text-xs bold-sm uppercase mb-3 gap-x-1.5', fg('title')),
    primaryThreadTitle: cn('row-center text-xs bold-sm uppercase mb-3 gap-x-1.5', primary('fg')),
    threadCount: cn('normal-case font-normal', fg('digest')),
    primaryThreadCount: cn('normal-case font-normal', primary('fg')),
    threadRules: 'grid grid-cols-2 gap-x-5 gap-y-1',
    readonlyItem: 'row-center w-1/2',
    checkIcon: cn('size-3 mr-1.5', rainbow(COLOR.GREEN, 'fill')),
    rootCheckIcon: cn('size-3 mr-1.5', rainbow(COLOR.GREEN, 'fill')),
  }
}
