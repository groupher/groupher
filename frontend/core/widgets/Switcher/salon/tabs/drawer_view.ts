import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, shadow } = useTwBelt()

  return {
    wrapper: cn('relative overflow-hidden w-full h-9 rounded-xl p-1', bg('hoverBg')),
    tabsContainer: 'row-center s-full relative z-10',
    tabItem: cn('align-both h-full grow rounded-md text-xs pointer', fg('digest')),
    activeTabItem: cn(fg('title')),
    slider: cn(
      'absolute top-1 bottom-1 left-1 rounded-md transition-all duration-200 ease-in-out',
      bg('card'),
      shadow('md'),
    ),
  }
}
