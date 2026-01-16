import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('column-center justify-start min-h-full w-full'),
    inner: cn('row w-full mt-7 min-h-screen'),
    children: 'column items-center grow bg-transparent',
  }
}
