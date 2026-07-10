import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, containerWrapper } = useTwBelt()

  return {
    wrapper: cn(containerWrapper('article'), 'w-full pt-12 pb-24'),
  }
}
