import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, bg, br, fg } = useTwBelt()

  const input = cn(
    'h-7 w-full rounded-md border px-2 text-sm outline-none',
    bg('card'),
    br('divider'),
    fg('title'),
  )

  return {
    wrapper: 'column min-w-0 flex-1 gap-y-1',
    input,
    error: cn('px-1 text-xs leading-4', fg('hint')),
  }
}
