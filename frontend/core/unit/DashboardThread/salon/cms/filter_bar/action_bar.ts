import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, rainbow } = useTwBelt()

  return {
    wrapper: cn('w-full pl-2 py-1.5 rounded-md', bg('hoverBg')),
    main: 'row-center w-full -ml-2 pl-2.5 pr-0 h-8',
    note: cn('row-center text-xs', fg('digest')),
    focus: cn('text-sm mx-1 -mt-0.5', rainbow(COLOR.RED, 'fg')),
    actionNotes: 'row-center ml-1',
    deleteNote: cn('text-xs bold ml-2', rainbow(COLOR.RED, 'fg')),
  }
}
