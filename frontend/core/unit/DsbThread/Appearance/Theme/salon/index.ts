import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br } = useTwBelt()

  return {
    presetSavingWrapper: cn('mt-12 border-b pb-8', br('divider')),
  }
}
