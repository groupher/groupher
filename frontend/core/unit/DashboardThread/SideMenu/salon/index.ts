import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  collapsed: boolean
}

export default function useSalon({ collapsed }: TProps) {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn(
      'column min-h-screen transition-all duration-150 ease-out',
      collapsed ? 'w-0 min-w-0' : 'w-40 min-w-40',
      fg('digest'),
    ),
    menuStack: 'grid w-full overflow-visible',
    menuLayer: 'w-full col-start-1 row-start-1 overflow-visible',
    collapsedRail: '-translate-x-20 translate-y-1.5',
  }
}
