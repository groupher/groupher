import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, br } = useTwBelt()

  return {
    wrapper: cn('row-center min-h-12 gap-x-8 overflow-x-auto border-b', br('divider')),
    tab: cn(
      'relative row-center h-12 px-1 button-reset text-base whitespace-nowrap transition-colors duration-150',
      fg('digest'),
      'hover:text-title after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent',
    ),
    tabActive: cn(fg('title'), 'bold-sm after:bg-primary'),
  }
}
