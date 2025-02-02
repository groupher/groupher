import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, sexyBorder } = useTwBelt()

  return {
    wrapper: 'column',
    divider: cn('mb-12', sexyBorder()),
  }
}
