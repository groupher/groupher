import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../useAppearanceBaseSalon'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, cnMerge, bg, rainbow } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.baseSection,
    block: cnMerge(base.blockBase, 'align-both w-full h-20'),
    blockActive: base.blockBaseActive,
    select: 'grid w-full grid-cols-1 gap-8 md:grid-cols-2',
    layout: 'column-align-both w-full min-w-0',
    list: 'row-center gap-x-2',
    divider: cn('h-6 w-px ml-4 mr-4 opacity-65', bg('digest')),
    avatar: 'align-both size-7 text-xs border bold-sm',
    blue: cn(
      rainbow(COLOR.BLUE, 'fg'),
      rainbow(COLOR.BLUE, 'bgSoft'),
      rainbow(COLOR.BLUE, 'borderSoft'),
    ),
    green: cn(
      rainbow(COLOR.GREEN, 'fg'),
      rainbow(COLOR.GREEN, 'bgSoft'),
      rainbow(COLOR.GREEN, 'borderSoft'),
    ),
    red: cn(
      rainbow(COLOR.RED, 'fg'),
      rainbow(COLOR.RED, 'bgSoft'),
      rainbow(COLOR.RED, 'borderSoft'),
    ),
    orange: cn(
      rainbow(COLOR.ORANGE, 'fg'),
      rainbow(COLOR.ORANGE, 'bgSoft'),
      rainbow(COLOR.ORANGE, 'borderSoft'),
    ),
    purple: cn(
      rainbow(COLOR.PURPLE, 'fg'),
      rainbow(COLOR.PURPLE, 'bgSoft'),
      rainbow(COLOR.PURPLE, 'borderSoft'),
    ),
  }
}
