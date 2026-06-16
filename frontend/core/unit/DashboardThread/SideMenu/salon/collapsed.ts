import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, br, hover, primary } = useTwBelt()

  return {
    wrapper: cn(
      'relative column h-full w-14 min-w-14 items-start -mt-1 cursor-pointer opacity-40 transition-opacity duration-300 delay-1000 hover:duration-100 hover:delay-0 hover:opacity-100',
      fg('digest'),
    ),
    menu: 'column items-center w-14 -mt-1.5',
    group: cn('column items-center gap-1.5 w-full py-2 border-b last:border-b-0', br('divider')),
    item: cn(
      'align-both relative size-8 rounded-md no-underline trans-all-100',
      fg('digest'),
      hover('bg'),
    ),
    toggleItem: cn(
      'align-both relative size-8 rounded-md border border-transparent pointer trans-all-200 mb-3',
      fg('digest'),
      hover('bg'),
    ),
    itemActive: cn(bg('hoverBg'), primary('fg')),
    icon: 'size-4',
  }
}
