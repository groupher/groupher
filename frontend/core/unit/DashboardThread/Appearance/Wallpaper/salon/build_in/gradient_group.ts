import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, shadow, br, bg, fill, primary } = useTwBelt()

  return {
    wrapper: 'row wrap s-full gap-3 mt-2.5 relative',
    card: cn(
      'w-44 h-28 rounded-md overflow-hidden relative border border-2 border-transparent pointer trans-all-200',
      br('divider'),
      `hover:${br('digest')}`,
    ),
    cardActive: cn(br('digest'), shadow('sm')),
    preview: 's-full',
    activeSign: cn(
      'size-5 circle absolute -top-1 -right-0.5 z-20 border',
      primary('bg'),
      br('title'),
    ),
    checkIcon: cn('size-3.5 absolute top-0.5 left-0.5', fill('button.fg')),
    penWrapper: cn('align-both size-4 circle', bg('card')),
    penIcon: cn('size-2.5', fill('digest')),
  }
}
