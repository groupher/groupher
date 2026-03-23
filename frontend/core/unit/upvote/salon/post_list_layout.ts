import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, vividDark } = useTwBelt()

  return {
    wrapper: cn('column-align-both gap-y-0.5', vividDark()),
  }
}
