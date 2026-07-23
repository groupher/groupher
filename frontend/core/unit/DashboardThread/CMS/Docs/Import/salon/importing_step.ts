import useTwBelt from '~/hooks/useTwBelt'

/** Returns presentation classes for the staging and apply phase. */
export default function useSalon() {
  const { cn, bg, br, fg } = useTwBelt()

  return {
    wrapper: cn(
      'column-align-both min-h-80 rounded-2xl border p-8 text-left',
      bg('card'),
      br('divider'),
    ),
    title: cn('w-full max-w-xl text-lg font-semibold text-balance', fg('title')),
    description: cn('mt-2 w-full max-w-xl text-sm leading-6 text-pretty', fg('digest')),
    process: 'mt-6 w-full max-w-xl',
  }
}
