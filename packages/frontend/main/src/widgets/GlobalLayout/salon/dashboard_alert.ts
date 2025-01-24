import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, fill } = useTwBelt()

  return {
    wrapper: cn(
      'row-center fixed bottom-8 w-[420px] h-10 px-4 shadow-lg z-20 rounded-xl',
      'left-1/2 -translate-x-1/2 ml-6',
      // TODO:
      // animation: ${animate.jump} 0.3s linear;
      bg('snackBar'),
    ),
    icon: cn('size-4 mr-2', fill('rainbow.orange')),
    title: cn('text-sm bold-sm grow', fg('text.invert')),
    resetBtn: cn(
      'min-w-15 h-5 text-xs px-1.5 rounded-md pointer smoky-90 transition-opacity',
      fg('text.title'),
      bg('popover.bg'),
    ),
    more: cn('row-center ml-2 h-5 text-xs border-b border-dashed smoky-90', fg('text.invert')),
  }
}
