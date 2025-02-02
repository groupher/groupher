import type { TSizeSM } from '~/spec'
import SIZE from '~/const/size'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = { size: TSizeSM; checked: boolean }

export default ({ size, checked }: TProps) => {
  const { cn, primary, br, bg, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'row-center w-12',
      checked && 'hover:brightness-110',
      size === SIZE.SMALL && 'scale-75',
    ),
    track: cn(
      'flex rounded-2xl w-full h-6 pointer relative overflow-hidden trans-all-200 border-2',
      checked ? primary('border') : br('divider'),
      checked ? primary('bg') : bg('divider'),
    ),
    indicator: cn(
      'row-center h-5 w-9 rounded-2xl trans-all-200',
      bg('button.toggle'),
      shadow('md'),
      checked ? 'translate-x-5' : '-translate-x-4',
    ),
    checkIcon: cn(
      'size-3 ml-1.5 opacity-0 transition-opacity',
      checked && 'opacity-100 ml-1',
      primary('fill'),
    ),
  }
}
