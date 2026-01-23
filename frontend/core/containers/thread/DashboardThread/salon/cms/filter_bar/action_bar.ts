import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, br, rainbow } = useTwBelt()

  return {
    wrapper: cn('w-full pl-2 py-1.5 my-2 rounded-md border', bg('hoverBg'), br('divider')),
    main: 'row-center w-full -ml-2 pl-2.5 pr-0 h-8',
    note: cn('row-center text-xs', fg('text.digest')),
    focus: cn('text-sm mx-1 -mt-0.5', rainbow(COLOR_NAME.RED, 'fg')),
    actionNotes: 'row-center ml-1',
    deleteNote: cn('text-xs bold ml-2', rainbow(COLOR_NAME.RED, 'fg')),
  }
}
