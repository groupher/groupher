import useTwBelt from '~/hooks/useTwBelt'

/** Returns presentation classes for the terminal import summary. */
export default function useSalon() {
  const { cn, bg, br, fg } = useTwBelt()

  return {
    wrapper: cn(
      'column-align-both min-h-80 rounded-2xl border p-8 text-center',
      bg('card'),
      br('divider'),
    ),
    successMark: cn(
      'column-align-both mb-5 size-11 rounded-full text-xl font-semibold',
      bg('sandBox'),
      fg('title'),
    ),
    title: cn('text-lg font-semibold text-balance', fg('title')),
    description: cn('mt-2 text-sm leading-6 text-pretty', fg('digest')),
    actions: 'mt-7 flex justify-center gap-3',
  }
}
