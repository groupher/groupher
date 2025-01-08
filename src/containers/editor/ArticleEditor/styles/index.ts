import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, br } = useTwBelt()

  return {
    wrapper: cn('row justify-center w-full'),
    inner: 'column w-full mt-8 px-20',
    funcRow: cn('row-center mt-2.5 mb-2.5 pb-5 border-b', br('divider')),
  }
}
