import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('row-center w-11/12 p-2.5', fg('digest')),
    inner: 'w-96 mt-5',
    items: 'column',
  }
}
