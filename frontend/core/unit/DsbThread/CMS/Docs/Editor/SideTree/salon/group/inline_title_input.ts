import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, bg, br, fg } = useTwBelt()

  return {
    input: cn(
      'h-6 w-full rounded-md border px-2 text-sm outline-none focus:border-digest',
      bg('card'),
      br('divider'),
      fg('title'),
    ),
  }
}
