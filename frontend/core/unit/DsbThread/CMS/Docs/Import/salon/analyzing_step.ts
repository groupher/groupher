import useTwBelt from '~/hooks/useTwBelt'

/** Returns presentation classes for the repository-analysis phase. */
export default function useSalon() {
  const { cn, bg, br, fg } = useTwBelt()

  return {
    wrapper: cn(
      'column-align-both min-h-80 rounded-2xl border px-8 py-10 text-left',
      bg('card'),
      br('divider'),
    ),
    title: cn('w-full max-w-xl pl-6.5 text-lg font-semibold text-balance', fg('title')),
    description: cn('mt-2 w-full max-w-xl pl-6.5 text-sm leading-6 text-pretty', fg('digest')),
    process: 'mt-6 w-full max-w-xl',
    hint: cn('mt-2 w-full max-w-xl pl-6.5 text-xs leading-5 text-pretty', fg('digest')),
  }
}
