import useTwBelt from '~/hooks/useTwBelt'

/** Returns presentation classes for bounded failed and skipped item details. */
export default function useSalon() {
  const { cn, bg, br, fg } = useTwBelt()

  return {
    wrapper: 'mt-5 w-full space-y-2 text-left',
    item: cn('column gap-1 rounded-lg border px-3 py-2', bg('sandBox'), br('divider')),
    path: cn('break-all text-xs font-medium', fg('title')),
    message: cn('text-xs leading-5', fg('rainbow.red')),
  }
}
