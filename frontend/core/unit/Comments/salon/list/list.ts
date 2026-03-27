import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br } = useTwBelt()

  return {
    wrapper: 'relative',
    indentLine: cn(
      'absolute top-20 left-0 h-[calc(100%-85px)] w-5 ml-2.5 border-l',
      br('outline'),
      `hover:${br('digest')}`,
    ),
  }
}
