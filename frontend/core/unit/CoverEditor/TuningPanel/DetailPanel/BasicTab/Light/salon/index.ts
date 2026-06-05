import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg, primary } = useTwBelt()

  return {
    wrapper: 'column w-full',
    grid: cn('grid grid-cols-3 gap-1 w-fit rounded-md border p-1', br('divider'), bg('card')),
    gridItem: cn(
      'size-5 circle border trans-all-100',
      br('divider'),
      bg('hoverBg'),
      `hover:${primary('border')}`,
    ),
    gridItemActive: primary('bg'),
  }
}
