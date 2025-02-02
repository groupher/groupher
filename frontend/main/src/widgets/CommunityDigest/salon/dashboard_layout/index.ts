import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, sexyBorder } = useTwBelt()

  return {
    wrapper: cn('w-full h-16 border-b', sexyBorder(25)),
    inner: cn('column justify-center mb-2 w-full'),
    content: 'column-center justify-between',
    baseInfo: 'row-center-between w-full pt-2.5',
  }
}
