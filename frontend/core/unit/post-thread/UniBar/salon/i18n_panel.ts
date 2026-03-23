import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, primary } = useTwBelt()

  return {
    wrapper: 'px-2.5 py-2',
    iconBox: 'align-both size-5 mr-1',
    checked: cn('size-4', primary('fill')),
  }
}
