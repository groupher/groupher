import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, bg } = useTwBelt()

  return {
    wrapper: cn(
      'w-full rounded-lg rounded-b-2xl border px-4 pt-3 pb-0 z-10',
      br('divider'),
      bg('card'),
    ),
    previewCardAttached: 'rounded-b-none',
    previewLayout: 'grid w-full grid-cols-2 gap-5',
    previewPanel: 'column-center min-h-44 min-w-0',
  }
}
