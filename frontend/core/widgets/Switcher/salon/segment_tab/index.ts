import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, bg } = useTwBelt()

  return {
    wrapper: cn('inline-flex h-8.5 max-w-full items-center rounded-lg p-1', bg('hoverBg')),
  }
}
