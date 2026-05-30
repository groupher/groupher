import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, bg } = useTwBelt()

  return {
    wrapper: cn('w-full rounded-lg rounded-b-2xl border px-4 py-3 z-10', br('divider'), bg('card')),
    previewCardAttached: 'rounded-b-none',
    previewLayout: 'grid grid-cols-2 w-full gap-5',
    previewPanel: 'column-center min-h-44',
  }
}
