import { COLOR } from '~/const/colors'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  active: boolean
}

export default function useSalon({ active }: TProps) {
  const { cn, fg, bg, primary, rainbow } = useTwBelt()
  const { isDarkTheme } = useTheme()

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
    itemTitle: cn('text-sm ml-2 min-w-flex truncate', fg('digest')),
    primaryItemTitle: cn('text-sm ml-2 min-w-flex truncate', primary('fg')),
    itemBars: 'ml-2 row-center shrink-0 gap-0.5 rounded px-1 py-0.5 trans-all-100',
    itemBar: 'h-3 w-1 rounded-full trans-all-100',
    itemBarDone: cn(rainbow(COLOR.GREEN, 'bg'), 'opacity-40'),
    itemBarPartial: cn(rainbow(COLOR.ORANGE, 'bg'), 'opacity-80'),
    itemBarEmpty: cn(bg('digest'), isDarkTheme ? 'opacity-40' : 'opacity-20'),
  }
}
