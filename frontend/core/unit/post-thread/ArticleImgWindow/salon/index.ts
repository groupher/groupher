import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg } = useTwBelt()

  return {
    wrapper: 'row-center',
    block: cn('w-1/3 h-16 mr-2.5 rounded', bg('hoverBg')),
  }
}
