import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, shadow, br, bg, fill } = useTwBelt()

  return {
    wrapper: 'row-center wrap gap-x-3.5 mt-2.5',
    ballWrapper: cn(
      'align-both size-9 circle mb-2.5 border-2 pointer trans-all-100',
      br('divider'),
      `hover:${br('digest')}`,
    ),
    ballActive: cn(br('digest'), shadow('sm')),
    colorBall: 'size-7 circle',
    penWrapper: cn('align-both size-4 circle', bg('card')),
    penIcon: cn('size-2.5', fill('digest')),
  }
}
