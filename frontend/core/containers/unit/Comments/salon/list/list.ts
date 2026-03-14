import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, br } = useTwBelt()

  return {
    wrapper: 'relative',
    indentLine: cn(
      'absolute top-20 left-0 h-[calc(100%-85px)] w-5 ml-1 border-l-2',
      br('divider'),
      `hover:${br('digest')}`,
    ),
  }
}
