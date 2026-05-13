import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  active: boolean
  completed: boolean
}

export default function useSalon({ active, completed }: TProps) {
  const { cn, fg, bg, primary, rainbow, rainbowSoft } = useTwBelt()

  return {
    wrapper: cn(
      'row-center min-w-0 w-full overflow-hidden rounded -mx-1 px-1 py-0.5 trans-all-100',
      `hover:${bg('hoverBg')}`,
      active && bg('hoverBg'),
    ),
    detailPanel: 'p-3 w-48',
    detailTitle: cn('text-xs bold-sm mb-2', fg('title')),
    primaryDetailTitle: cn('text-xs bold-sm mb-2', primary('fg')),
    detailList: 'column gap-y-1',
    itemTitle: cn('text-sm ml-2 min-w-0 flex-1 truncate', fg('digest')),
    primaryItemTitle: cn('text-sm ml-2 min-w-0 flex-1 truncate', primary('fg')),
    itemCount: cn(
      'ml-1 text-xs bold-sm shrink-0 rounded-lg px-1.5 py-0.5',
      rainbow(completed ? COLOR.GREEN : COLOR.ORANGE, 'fg'),
      active && rainbowSoft(completed ? COLOR.GREEN : COLOR.ORANGE),
    ),
  }
}
