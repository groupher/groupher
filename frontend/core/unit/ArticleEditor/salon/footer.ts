import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br } = useTwBelt()

  return {
    wrapper: 'w-full pl-1',
    publishFooter: cn('w-full row-between', 'border-t-2', br('divider'), 'mt-7 pt-5 pl-5 pr-9'),
  }
}
