import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, bg } = useTwBelt()

  return {
    wrapper: cn('row-center'),
    block: cn('w-1/3 h-16 mr-2.5 rounded', bg('hoverBg')),
  }
}
