import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, sexyBorder } = useTwBelt()

  return {
    wrapper: 'column w-full items-end',
    inner: 'w-11/12',
    divider: cn('mb-12', sexyBorder()),
  }
}
