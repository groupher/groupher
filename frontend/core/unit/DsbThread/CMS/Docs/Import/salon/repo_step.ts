import useTwBelt from '~/hooks/useTwBelt'

/** Returns presentation classes for repository source entry. */
export default function useSalon() {
  const { cn, fg, panel } = useTwBelt()

  return {
    wrapper: panel(),
    title: cn('text-lg font-semibold text-balance', fg('title')),
    description: cn('mt-2 text-sm leading-6 text-pretty', fg('digest')),
    descriptionHint: 'ml-1',
    label: cn('mt-7 mb-2 block text-sm font-medium', fg('title')),
    input: cn('h-12 rounded-lg px-3 text-sm not-italic', fg('title')),
    error: cn('text-sm leading-6', fg('rainbow.red')),
    footer: 'mt-6 flex items-end justify-between gap-6',
    platforms: cn('column w-1/2 min-w-0 whitespace-nowrap text-sm', fg('digest')),
    platformsTitle: cn('text-xs font-medium', fg('title')),
  }
}
