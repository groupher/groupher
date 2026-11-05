import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br } = useTwBelt()

  return {
    wrapper: 'relative',
    indentLine: cn(
      'absolute top-14 bottom-4 left-0 w-5 ml-2.5 border-l border-b rounded-bl-xl',
      br('outline'),
      `hover:${br('digest')}`,
    ),
  }
}
