import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { bg, cn } = useTwBelt()

  return {
    wrapper: cn('min-h-96 rounded-xl px-5 py-4', bg('card')),
  }
}
