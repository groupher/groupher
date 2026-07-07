import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

const ACTION_COLOR = {
  created: COLOR.GREEN,
  deleted: COLOR.RED,
  modified: COLOR.BLUE,
  moved: COLOR.PURPLE,
  renamed: COLOR.ORANGE,
} as const

type TActionColorKey = keyof typeof ACTION_COLOR

export default function useSalon() {
  const { cn, fg, bg, br, rainbow } = useTwBelt()

  const actionColor = (action: string): string => {
    const color = ACTION_COLOR[action.toLowerCase() as TActionColorKey]

    return color ? rainbow(color, 'fg') : fg('digest')
  }

  return {
    plan: cn('column w-full gap-3 pb-1 text-xs', fg('digest')),
    section: 'column gap-1.5',
    heading: cn('row-center gap-2 px-1 bold-sm', fg('digest')),
    count: cn(
      'align-both h-5 min-w-5 shrink-0 rounded-md px-1.5 tabular-nums',
      bg('badge'),
      fg('digest'),
    ),
    items: cn('column max-h-28 gap-1 overflow-y-auto rounded-md border px-2 py-1.5', br('divider')),
    item: 'row-center min-w-0 justify-between gap-3',
    title: cn('min-w-0 flex-1 truncate', fg('title')),
    action: (action: string): string => cn('shrink-0 bold-sm', actionColor(action)),
  }
}
