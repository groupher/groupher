import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, br, bg } = useTwBelt()
  return {
    wrapper: 'column min-h-full gap-6 px-6 py-8 sm:px-8',
    title: cn('text-xl bold-sm', fg('title')),
    list: 'column gap-3',
    item: cn('row-between gap-4 rounded-xl p-4', bg('card')),
    button: cn(
      'min-h-10 rounded-lg border px-4 text-sm disabled:opacity-50',
      br('divider'),
      fg('title'),
    ),
    error: 'rounded-lg bg-rainbow-redLite px-4 py-3 text-sm text-rainbow-red',
  }
}
