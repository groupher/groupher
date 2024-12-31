import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, sexyHBorder } = useTwBelt()

  return {
    wrapper: 'column',
    divider: cn('mb-12', sexyHBorder()),
  }
}
