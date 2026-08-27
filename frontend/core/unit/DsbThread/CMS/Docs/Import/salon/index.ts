import useTwBelt from '~/hooks/useTwBelt'

/** Returns page-level presentation classes for the Docs import journey. */
export default function useSalon() {
  const { cn, fg, panel } = useTwBelt()

  return {
    wrapper: 'w-full max-w-5xl',
    intro: 'mb-7 max-w-2xl mt-2',
    title: cn('text-2xl font-semibold text-balance', fg('title')),
    description: cn('mt-2 text-sm leading-6 text-pretty', fg('digest')),
    failureCard: panel('column gap-4'),
    error: cn('text-sm leading-6', fg('rainbow.red')),
  }
}
