import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, fill, hover } = useTwBelt()

  return {
    wrapper: cn(
      'row-center fixed bottom-8 w-fit h-10 pl-4 pr-2 shadow-lg z-20 rounded-xl',
      'left-1/2 -translate-x-1/2 ml-6',
      // TODO:
      // animation: ${animate.jump} 0.3s linear;
      bg('card'),
    ),
    icon: cn('size-4 mr-2', fill('rainbow.orange')),
    title: cn('text-sm bold-sm grow mr-10', fg('digest')),
    resetBtn: cn(
      'min-w-15 h-5 text-xs px-1.5 rounded-md pointer smoky-90 transition-opacity',
      fg('title'),
      bg('popover.bg'),
    ),
    moreBox: cn('size-5 ml-1', hover('box')),
    moreIcon: cn('size-3.5', hover('icon')),
  }
}
