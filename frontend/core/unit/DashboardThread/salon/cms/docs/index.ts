import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br } = useTwBelt()

  return {
    wrapper: 'w-full',
    tabs: cn('-mt-2.5 mb-6 border-b', br('divider')),
  }
}
