import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, primary } = useTwBelt()

  return {
    title: cn('max-w-48 truncate text-sm bold-sm', primary('fg')),
  }
}
