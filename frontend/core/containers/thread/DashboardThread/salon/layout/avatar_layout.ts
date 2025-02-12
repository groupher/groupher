import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'
import useBase from '.'

export { cn } from '~/css'

export default () => {
  const { cn, bg, rainbow } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.baseSection,
    block: cn(base.blockBase, 'align-both w-64 h-20'),
    blockActive: base.blockBaseActive,
    select: cn('row-center gap-x-8 w-full'),
    layout: 'column-align-both',
    list: 'row-center gap-x-2',
    divider: cn('h-6 w-px ml-4 mr-4 opacity-65', bg('text.digest')),
    avatar: cn('align-both size-7 text-xs border bold-sm rounded'),
    blue: cn(
      rainbow(COLOR_NAME.BLUE, 'fg'),
      rainbow(COLOR_NAME.BLUE, 'bgSoft'),
      rainbow(COLOR_NAME.BLUE, 'borderSoft'),
    ),
    green: cn(
      rainbow(COLOR_NAME.GREEN, 'fg'),
      rainbow(COLOR_NAME.GREEN, 'bgSoft'),
      rainbow(COLOR_NAME.GREEN, 'borderSoft'),
    ),
    red: cn(
      rainbow(COLOR_NAME.RED, 'fg'),
      rainbow(COLOR_NAME.RED, 'bgSoft'),
      rainbow(COLOR_NAME.RED, 'borderSoft'),
    ),
    orange: cn(
      rainbow(COLOR_NAME.ORANGE, 'fg'),
      rainbow(COLOR_NAME.ORANGE, 'bgSoft'),
      rainbow(COLOR_NAME.ORANGE, 'borderSoft'),
    ),
    purple: cn(
      rainbow(COLOR_NAME.PURPLE, 'fg'),
      rainbow(COLOR_NAME.PURPLE, 'bgSoft'),
      rainbow(COLOR_NAME.PURPLE, 'borderSoft'),
    ),
  }
}
