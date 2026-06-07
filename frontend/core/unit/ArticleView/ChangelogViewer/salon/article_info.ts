import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br } = useTwBelt()

  return {
    wrapper: cn('row-between w-full h-20 border-b pb-3 mt-2', br('divider')),
    baseWrapper: 'row-center w-full',
  }
}
