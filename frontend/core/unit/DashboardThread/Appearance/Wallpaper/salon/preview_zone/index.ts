import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, bg } = useTwBelt()

  return {
    previewCard: cn('w-full rounded-lg border px-4 py-3', br('divider'), bg('cardAlpha')),
    previewLayout: 'grid grid-cols-2 w-full gap-5',
    previewPanel: 'column-center min-h-44',
    settingsCard: cn('w-full rounded-lg border px-6 py-5 mt-6', br('divider'), bg('cardAlpha')),
  }
}
