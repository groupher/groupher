import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = {
  slipBarPos: 'top' | 'bottom'
  topSpace: number
  bottomSpace: number
} & TSpace

export default function useSalon({ slipBarPos, topSpace, bottomSpace, ...spacing }: TProps) {
  const { cn, fg, bg, margin, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'relative overflow-hidden w-full h-9 rounded-xl p-1',
      bg('hoverBg'),
      margin(spacing),
    ),
    tabsContainer: 'row-center s-full relative z-10',
    tabItem: cn('align-both h-full grow rounded-md text-xs pointer', fg('digest')),
    activeTabItem: cn(fg('title')),
    slider: cn(
      'absolute left-1 rounded-md transition-all duration-200 ease-in-out',
      slipBarPos === 'top' ? `top-${topSpace}` : 'top-1',
      slipBarPos === 'bottom' ? `bottom-${bottomSpace}` : 'bottom-1',
      bg('card'),
      shadow('md'),
    ),
  }
}
