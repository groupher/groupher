import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, zise, primary } = useTwBelt()

  return {
    wrapper: 'row-center mb-5 w-full group',
    arrow: cn('ml-1 mr-2 group-smoky-65', zise(2.5), primary('fill')),
    title: cn('text-xs', primary('fg'), 'group-hover:bold-sm', 'transition-colors pointer'),
  }
}
