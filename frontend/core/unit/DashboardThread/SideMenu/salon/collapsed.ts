import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, br, hover, primary, vividDark } = useTwBelt()

  return {
    wrapper: cn('column w-14 min-w-14 items-center', fg('digest')),
    menu: cn('column items-center w-full py-1 border-r', br('divider')),
    group: cn('column items-center gap-1.5 w-full py-2 border-b last:border-b-0', br('divider')),
    item: cn(
      'align-both relative size-8 rounded-md no-underline trans-all-200',
      fg('digest'),
      hover('bg'),
    ),
    itemActive: cn(bg('hoverBg'), primary('fg'), vividDark(), 'shadow-sm'),
    icon: 'size-4',
  }
}
