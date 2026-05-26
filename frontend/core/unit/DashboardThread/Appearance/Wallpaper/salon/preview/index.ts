import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, bg } = useTwBelt()

  return {
    previewCard: cn('w-full rounded-lg border py-2 pl-4', br('divider'), bg('cardAlpha')),
    previewLayout: 'grid grid-cols-2 w-full gap-10',
    previewPanel: 'column-center min-h-44',
    customizePanel: 'column-center min-h-44',
  }
}
